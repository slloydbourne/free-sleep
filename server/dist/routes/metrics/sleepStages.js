import express from 'express';
import moment from 'moment-timezone';
import { loadSleepStages } from '../../db/loadSleepStages.js';
import { prisma } from '../../db/prisma.js';
const router = express.Router();
router.get('/sleep-stages', async (req, res) => {
    const { startTime, endTime, side } = req.query;
    const query = {
        timestamp: {},
    };
    if (side)
        query.side = side;
    if (startTime) {
        // @ts-expect-error
        query.timestamp.gte = moment(startTime).unix();
    }
    if (endTime) {
        // @ts-expect-error
        query.timestamp.lte = moment(endTime).unix();
    }
    const sleepStageRecords = await prisma.sleep_stages.findMany({
        where: query,
        orderBy: { timestamp: 'asc' },
    });
    const formattedRecords = await loadSleepStages(sleepStageRecords);
    res.json(formattedRecords);
});
export default router;
//# sourceMappingURL=sleepStages.js.map