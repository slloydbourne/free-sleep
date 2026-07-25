"""
Crude sleep-stage classifier - FIRST PASS, needs calibration against real pod data.

Buckets an already-recorded sleep session into awake/light/deep/rem stages using
the heart_rate/hrv/breathing_rate already stored in the `vitals` table (written
continuously by stream/biometric_processor.py) and the movement already stored in
the `movement` table (written by sleep_detector.detect_movement during the nightly
analyze_sleep job). No new sensor processing happens here - this only reads what's
already been computed and stored.

This is intentionally simple: real polysomnography-grade staging needs EEG. The
approach here - movement + heart-rate-variability heuristics - is the same class of
technique consumer actigraphy wearables use ("crude but useful", not clinical). All
thresholds are computed relative to THIS session's own heart rate/movement/HRV
distribution rather than fixed absolute numbers, since resting heart rate varies a
lot person to person. Expect to retune the quantiles below once real overnight data
is available.

Usage:
    python3 stage_classifier.py --side=left --start_time="2025-01-20 22:00:00" --end_time="2025-01-21 07:00:00"
"""
import sys
import os
import gc
import platform
from argparse import ArgumentParser, Namespace

import pandas as pd

sys.path.append(os.getcwd())

if platform.system().lower() == 'linux':
    sys.path.append('/home/dac/free-sleep/biometrics/')

from get_logger import get_logger
logger = get_logger('stage-classifier')

from biometrics_helpers import validate_datetime_utc
from db import conn, insert_sleep_stages

VITALS_QUERY = """
    SELECT timestamp, heart_rate, hrv, breathing_rate
    FROM vitals
    WHERE side = ? AND timestamp >= ? AND timestamp <= ?
    ORDER BY timestamp ASC
"""

MOVEMENT_QUERY = """
    SELECT timestamp, total_movement
    FROM movement
    WHERE side = ? AND timestamp >= ? AND timestamp <= ?
    ORDER BY timestamp ASC
"""


def classify_stages(vitals_df: pd.DataFrame, movement_df: pd.DataFrame) -> pd.DataFrame:
    """
    Assigns one of 'awake' | 'light' | 'deep' | 'rem' to each vitals row.
    """
    if vitals_df.empty:
        return vitals_df

    df = vitals_df.copy()

    if not movement_df.empty:
        # Movement is on its own ~2-minute grid, vitals on ~3-minute - snap each
        # vitals row to its nearest movement bucket within 5 minutes
        df = pd.merge_asof(
            df.sort_values('timestamp'),
            movement_df.sort_values('timestamp').rename(columns={'timestamp': 'movement_ts'}),
            left_on='timestamp',
            right_on='movement_ts',
            direction='nearest',
            tolerance=300,
        )

    if 'total_movement' not in df.columns or df['total_movement'].isna().all():
        df['total_movement'] = 0
    else:
        df['total_movement'] = df['total_movement'].fillna(0)

    # Session-relative baselines
    hr_baseline = df['heart_rate'].median()
    hr_low = df['heart_rate'].quantile(0.20)
    movement_high = df['total_movement'].quantile(0.85)
    hrv_high = df['hrv'].quantile(0.70)

    def _classify(row) -> str:
        # High movement, or heart rate at/above the session's own median -> awake
        if row['total_movement'] >= movement_high or row['heart_rate'] >= hr_baseline:
            return 'awake'
        # Low heart rate + low movement + calmer HRV -> deep sleep proxy
        if row['heart_rate'] <= hr_low and row['hrv'] < hrv_high:
            return 'deep'
        # Low movement (body atonia) but more erratic HRV -> REM proxy
        # (REM is characterized by autonomic irregularity despite muscle atonia)
        if row['hrv'] >= hrv_high:
            return 'rem'
        return 'light'

    df['stage'] = df.apply(_classify, axis=1)
    return df[['timestamp', 'stage']]


def _parse_args() -> Namespace:
    parser = ArgumentParser(description="Classify recorded vitals/movement into crude sleep stages.")
    parser.add_argument("--side", choices=["left", "right"], required=True)
    parser.add_argument("--start_time", type=validate_datetime_utc, required=True)
    parser.add_argument("--end_time", type=validate_datetime_utc, required=True)
    args = parser.parse_args()
    if args.start_time >= args.end_time:
        raise ValueError("--start_time must be earlier than --end_time")
    return args


if __name__ == "__main__":
    args = _parse_args()
    start_epoch = int(args.start_time.timestamp())
    end_epoch = int(args.end_time.timestamp())

    try:
        vitals_df = pd.read_sql_query(VITALS_QUERY, conn, params=(args.side, start_epoch, end_epoch))
        movement_df = pd.read_sql_query(MOVEMENT_QUERY, conn, params=(args.side, start_epoch, end_epoch))

        if vitals_df.empty:
            logger.warning(f'No vitals found for {args.side} side between {args.start_time} and {args.end_time}, skipping stage classification')
            sys.exit(0)

        stages_df = classify_stages(vitals_df, movement_df)
        insert_sleep_stages(args.side, stages_df)
        logger.info(f'Classified {len(stages_df)} stage buckets for {args.side} side')
    except Exception as error:
        logger.error(error)
        raise
    finally:
        gc.collect()
