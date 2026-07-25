import { z } from 'zod';
import { SideSchema } from './schedulesSchema.js';

export const SLEEP_STAGES = ['awake', 'light', 'deep', 'rem'] as const;
export const SleepStageSchema = z.enum(SLEEP_STAGES);

export const sleepStageRecordSchema = z.object({
  id: z.number(),
  side: SideSchema,
  timestamp: z.number().int(), // Epoch timestamp
  stage: SleepStageSchema,
});

export type SleepStage = z.infer<typeof SleepStageSchema>;
export type SleepStageRecord = z.infer<typeof sleepStageRecordSchema>;
