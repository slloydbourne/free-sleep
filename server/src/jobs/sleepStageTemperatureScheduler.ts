import schedule from 'node-schedule';
import moment from 'moment-timezone';

import { Settings } from '../db/settingsSchema.js';
import { Side } from '../db/schedulesSchema.js';
import { SleepStage } from '../db/sleepStagesSchema.js';
import { prisma } from '../db/prisma.js';
import servicesDB from '../db/services.js';
import serverStatus from '../serverStatus.js';
import logger from '../logger.js';
import { updateDeviceStatus } from '../routes/deviceStatus/updateDeviceStatus.js';
import { getPresence } from '../routes/metrics/presence.js';

const CHECK_INTERVAL_MINUTES = 10;
// How far back to pull vitals when estimating the current stage - short enough to
// react to real changes overnight, long enough to smooth out single noisy readings
const LOOKBACK_MINUTES = 20;
// stream.py writes roughly one vitals row a minute while someone's present - below
// this we don't have enough signal yet to trust a classification
const MIN_VITALS_ROWS = 5;

// Mirrors the heuristic in biometrics/sleep_detection/stage_classifier.py - keep the
// two in sync if one changes. This live version has no movement signal (movement is
// only computed after the fact, see that file's docstring), so it leans more on
// heart rate/HRV relative to this session's own recent readings. First-pass, crude -
// expect to retune once real overnight data is available.
export const classifyCurrentStage = (heartRates: number[], hrvs: number[]): SleepStage => {
  const sortedHr = [...heartRates].sort((a, b) => a - b);
  const median = sortedHr[Math.floor(sortedHr.length / 2)];
  const low = sortedHr[Math.floor(sortedHr.length * 0.2)];
  const currentHr = heartRates[heartRates.length - 1];

  const sortedHrv = [...hrvs].sort((a, b) => a - b);
  const hrvHigh = sortedHrv[Math.floor(sortedHrv.length * 0.7)];
  const currentHrv = hrvs[hrvs.length - 1];

  if (currentHr >= median) return 'awake';
  if (currentHr <= low && currentHrv < hrvHigh) return 'deep';
  if (currentHrv >= hrvHigh) return 'rem';
  return 'light';
};

const applyStageTemperature = async (side: Side, settingsData: Settings) => {
  const stageSettings = settingsData[side].sleepStageTemperatures;
  if (!stageSettings.enabled) return;
  if (settingsData[side].awayMode) return;

  await servicesDB.read();
  if (!servicesDB.data.biometrics.enabled) return;

  const presence = getPresence(side);
  if (!presence.present) return;

  const since = moment().subtract(LOOKBACK_MINUTES, 'minutes').unix();
  const recentVitals = await prisma.vitals.findMany({
    where: { side, timestamp: { gte: since } },
    orderBy: { timestamp: 'asc' },
  });

  if (recentVitals.length < MIN_VITALS_ROWS) {
    logger.debug(`Not enough recent vitals for ${side} to classify sleep stage yet (${recentVitals.length}/${MIN_VITALS_ROWS})`);
    return;
  }

  const heartRates = recentVitals.map((v) => v.heart_rate).filter((v): v is number => v !== null);
  const hrvs = recentVitals.map((v) => v.hrv).filter((v): v is number => v !== null);
  if (heartRates.length < MIN_VITALS_ROWS || hrvs.length < MIN_VITALS_ROWS) {
    logger.debug(`Not enough valid heart_rate/hrv readings for ${side} to classify sleep stage yet`);
    return;
  }

  const stage = classifyCurrentStage(heartRates, hrvs);
  const targetTemperatureF = stageSettings[stage];

  logger.debug(`Sleep stage for ${side}: ${stage} -> setting temperature to ${targetTemperatureF}F`);
  await updateDeviceStatus({
    [side]: { targetTemperatureF },
  });
};

export const scheduleSleepStageTemperatures = (settingsData: Settings) => {
  const anyEnabled = settingsData.left.sleepStageTemperatures.enabled || settingsData.right.sleepStageTemperatures.enabled;
  if (!anyEnabled) return;
  if (settingsData.timeZone === null) return;

  const rule = new schedule.RecurrenceRule();
  rule.minute = new schedule.Range(0, 59, CHECK_INTERVAL_MINUTES);
  rule.tz = settingsData.timeZone;

  logger.debug(`Scheduling sleep-stage temperature job every ${CHECK_INTERVAL_MINUTES} minutes`);
  schedule.scheduleJob('sleep-stage-temperature-check', rule, async () => {
    try {
      await applyStageTemperature('left', settingsData);
      await applyStageTemperature('right', settingsData);
      serverStatus.status.sleepStageTemperatureSchedule.status = 'healthy';
      serverStatus.status.sleepStageTemperatureSchedule.message = '';
    } catch (error: unknown) {
      serverStatus.status.sleepStageTemperatureSchedule.status = 'failed';
      const message = error instanceof Error ? error.message : String(error);
      serverStatus.status.sleepStageTemperatureSchedule.message = message;
      logger.error(error);
    }
  });
};
