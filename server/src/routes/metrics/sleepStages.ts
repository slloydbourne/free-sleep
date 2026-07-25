import express, { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import moment from 'moment-timezone';
import { loadSleepStages } from '../../db/loadSleepStages.js';
import { prisma } from '../../db/prisma.js';

const router = express.Router();

interface SleepStagesQuery {
  side?: string;
  startTime?: string;
  endTime?: string;
}

router.get('/sleep-stages', async (req: Request<object, object, object, SleepStagesQuery>, res: Response) => {
  const { startTime, endTime, side } = req.query;
  const query: Prisma.sleep_stagesWhereInput = {
    timestamp: {},
  };

  if (side) query.side = side;
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
