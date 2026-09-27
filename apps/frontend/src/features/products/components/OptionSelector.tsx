import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import FormLabel from '@mui/material/FormLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useId } from 'react';
import { formatPrice } from '../../../lib/utils/format';
import type { ProductOption, TrackedProduct } from '../../../types/product';

type OptionSelectorProps = {
  label: string;
  options: ProductOption[];
  value: string; // '' until the user picks one; nothing is pre-selected
  onChange: (optionId: string) => void;
  tracked: Map<string, TrackedProduct>;
  disableTracked?: boolean; // when choosing an option to track, a tracked one cannot be picked again
  error?: string;
};

// A native radio group: arrow keys move between options, and the selected one shows the radio dot and a border.
export function OptionSelector({ label, options, value, onChange, tracked, disableTracked = false, error }: OptionSelectorProps) {
  const labelId = useId();

  return (
    <FormControl error={Boolean(error)} fullWidth>
      <FormLabel id={labelId} sx={{ mb: 1, fontSize: '0.8125rem', fontWeight: 600, color: 'text.primary', '&.Mui-focused': { color: 'text.primary' } }}>
        {label}
      </FormLabel>
      <RadioGroup aria-labelledby={labelId} value={value} onChange={(_, optionId) => onChange(optionId)} sx={{ gap: 1 }}>
        {options.map(option => {
          const item = tracked.get(option.id);
          const selected = value === option.id;
          return (
            <FormControlLabel
              key={option.id}
              value={option.id}
              disabled={disableTracked && Boolean(item)}
              control={<Radio size="small" />}
              label={
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between', minWidth: 0 }}>
                  <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                    {option.label}
                  </Typography>
                  {item && (
                    <Typography variant="caption" noWrap sx={{ color: 'text.secondary', flexShrink: 0 }}>
                      {disableTracked ? 'Already tracked' : 'Tracked'}
                      {item.latest && ` · ${formatPrice(item.latest.price, item.latest.currency)}`}
                    </Typography>
                  )}
                </Stack>
              }
              sx={theme => ({
                m: 0,
                pl: 0.5,
                pr: 1.5,
                py: 0.25,
                border: 1,
                borderRadius: 2,
                borderColor: selected ? 'primary.main' : 'divider',
                bgcolor: selected ? `rgba(${theme.vars.palette.primary.mainChannel} / 0.06)` : 'transparent',
                '& .MuiFormControlLabel-label': { flex: 1, minWidth: 0 },
              })}
            />
          );
        })}
      </RadioGroup>
      {error && <FormHelperText sx={{ mx: 0 }}>{error}</FormHelperText>}
    </FormControl>
  );
}
