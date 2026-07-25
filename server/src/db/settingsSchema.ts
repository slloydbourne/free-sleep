import { z } from 'zod';
import { TIME_ZONES } from './timeZones.js';
import { TemperatureSchema, TimeSchema } from './schedulesSchema.js';

export const TEMPERATURES = ['celsius', 'fahrenheit'] as const;
const Temperatures = z.enum(TEMPERATURES);

export const PRIME_FREQUENCIES = ['daily', 'monthly'] as const;
const PrimeFrequency = z.enum(PRIME_FREQUENCIES);


const TemperatureTapConfig = z.object({
  type: z.literal('temperature'),
  change: z.enum(['increment', 'decrement']),
  amount: z.number().min(0).max(10),
});

const AlarmTapConfig = z.object({
  type: z.literal('alarm'),
  behavior: z.enum(['snooze', 'dismiss']),
  snoozeDuration: z.number().min(60).max(600),
  inactiveAlarmBehavior: z.enum(['power', 'none'])
});

export const TapConfig = z.discriminatedUnion('type', [
  TemperatureTapConfig,
  AlarmTapConfig,
]);

export const GestureSchema = z.enum(['doubleTap', 'tripleTap', 'quadTap']);

// Crude, first-pass sleep-stage temperature control - see
// biometrics/sleep_detection/stage_classifier.py for how stages are detected.
// One target temperature per stage; applied live while enabled.
const SleepStageTemperaturesSchema = z.object({
  enabled: z.boolean(),
  awake: TemperatureSchema,
  light: TemperatureSchema,
  deep: TemperatureSchema,
  rem: TemperatureSchema,
}).strict();

export type SleepStageTemperatures = z.infer<typeof SleepStageTemperaturesSchema>;

const SideSettingsSchema = z.object({
  name: z.string().min(1).max(20),
  awayMode: z.boolean(),
  sleepStageTemperatures: SleepStageTemperaturesSchema,
  scheduleOverrides: z.object({
    temperatureSchedules: z.object({
      disabled: z.boolean(),
      expiresAt: z.string(),
    }),
    alarm: z.object({
      disabled: z.boolean(),
      timeOverride: z.string(),
      expiresAt: z.string(),
    })
  }),
  taps: z.object({
    doubleTap: TapConfig,
    tripleTap: TapConfig,
    quadTap: TapConfig,
  })
}).strict();

export const SettingsSchema = z.object({
  id: z.string(),
  timeZone: z.enum(TIME_ZONES),
  left: SideSettingsSchema,
  right: SideSettingsSchema,
  primePodDaily: z.object({
    enabled: z.boolean(),
    time: TimeSchema,
    frequency: PrimeFrequency,
    // Capped at 28 so it fires reliably in every month, including February
    dayOfMonth: z.number().int().min(1).max(28),
  }),
  temperatureFormat: Temperatures,
  rebootDaily: z.boolean(),
}).strict();

export type SideSettings = z.infer<typeof SideSettingsSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type Gesture = z.infer<typeof GestureSchema>
