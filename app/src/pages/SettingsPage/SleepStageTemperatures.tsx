import { Box, FormControlLabel, TextField, Typography } from '@mui/material';
import Switch from '@mui/material/Switch';
import { DeepPartial } from 'ts-essentials';

import { Settings } from '@api/settingsSchema.ts';
import { Side, useAppStore } from '@state/appStore.tsx';

type SleepStageTemperaturesProps = {
  side: Side;
  settings?: Settings;
  updateSettings: (settings: DeepPartial<Settings>) => void;
}

const STAGES = [
  { key: 'awake', label: 'Awake' },
  { key: 'light', label: 'Light' },
  { key: 'deep', label: 'Deep' },
  { key: 'rem', label: 'REM' },
] as const;

export default function SleepStageTemperatures({ side, settings, updateSettings }: SleepStageTemperaturesProps) {
  const { isUpdating } = useAppStore();
  const title = side.charAt(0).toUpperCase() + side.slice(1);
  const stageSettings = settings?.[side]?.sleepStageTemperatures;

  return (
    <Box sx={ { display: 'flex', flexDirection: 'column', gap: 1, mb: 2 } }>
      <FormControlLabel
        control={
          <Switch
            disabled={ isUpdating }
            checked={ stageSettings?.enabled || false }
            onChange={ (event) => updateSettings({
              [side]: { sleepStageTemperatures: { enabled: event.target.checked } },
            }) }
          />
        }
        label={ `${title} side: adjust temperature by sleep stage` }
      />
      { stageSettings?.enabled && (
        <Box sx={ { display: 'flex', gap: 2, flexWrap: 'wrap', ml: 1 } }>
          { STAGES.map(({ key, label }) => (
            <TextField
              key={ key }
              label={ label }
              type="number"
              size="medium"
              variant="standard"
              value={ stageSettings?.[key] ?? '' }
              onChange={ (e) => {
                const value = Number(e.target.value);
                if (Number.isNaN(value)) return;
                updateSettings({
                  [side]: { sleepStageTemperatures: { [key]: value } },
                });
              } }
              disabled={ isUpdating }
              slotProps={ { htmlInput: { min: 55, max: 110 } } }
              sx={ { width: '90px' } }
            />
          )) }
        </Box>
      ) }
      <Typography variant="body2" color="text.secondary" sx={ { ml: 1 } }>
        Sleep stage is a crude estimate from heart rate/HRV trends, not a medical-grade
        measurement - treat this as experimental.
      </Typography>
    </Box>
  );
}
