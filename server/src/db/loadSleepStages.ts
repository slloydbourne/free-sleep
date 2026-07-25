// Helper file to load raw sleep stage rows from SQLite and convert the epoch timestamps -> ISO8601
import { sleep_stages as PrismaSleepStageRecord } from '.prisma/client';
import settingsDB from './settings.js';
import moment from 'moment-timezone';

import { SleepStageRecord } from './prismaDbTypes.js';

export const loadSleepStages = async (sleepStageRecords: PrismaSleepStageRecord[]): Promise<SleepStageRecord[]> => {
  await settingsDB.read();
  const userTimeZone: string = settingsDB.data.timeZone || 'UTC';

  return sleepStageRecords.map((record: any) => ({
    ...record,
    timestamp: moment.tz(record.timestamp * 1000, userTimeZone).format(),
  })) as SleepStageRecord[];
};
