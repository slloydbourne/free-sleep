import settingsDB from './settings.js';
import moment from 'moment-timezone';
export const loadSleepStages = async (sleepStageRecords) => {
    await settingsDB.read();
    const userTimeZone = settingsDB.data.timeZone || 'UTC';
    return sleepStageRecords.map((record) => ({
        ...record,
        timestamp: moment.tz(record.timestamp * 1000, userTimeZone).format(),
    }));
};
//# sourceMappingURL=loadSleepStages.js.map