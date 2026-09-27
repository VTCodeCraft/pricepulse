import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import FormLabel from '@mui/material/FormLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import { useId } from 'react';
import type { ProductOption, TrackedProduct } from '../../../types/product';
import { OptionRow } from './OptionRow';

type OptionSelectorProps = {
  label: string;
  options: ProductOption[];
  value: string; // '' until the user picks one; nothing is pre-selected
  onChange: (optionId: string) => void;
  tracked: Map<string, TrackedProduct>;
  error?: string;
};

// A native radio group: arrow keys move between options, and the selected one shows the radio dot and a border.
export function OptionSelector({ label, options, value, onChange, tracked, error }: OptionSelectorProps) {
  const labelId = useId();

  return (
    <FormControl error={Boolean(error)} fullWidth>
      <FormLabel id={labelId} sx={{ mb: 1, fontSize: '0.8125rem', fontWeight: 600, color: 'text.primary', '&.Mui-focused': { color: 'text.primary' } }}>
        {label}
      </FormLabel>
      <RadioGroup aria-labelledby={labelId} value={value} onChange={(_, optionId) => onChange(optionId)} sx={{ gap: 1 }}>
        {options.map(option => (
          <OptionRow
            key={option.id}
            value={option.id}
            control={<Radio size="small" />}
            label={option.label}
            item={tracked.get(option.id)}
            selected={value === option.id}
          />
        ))}
      </RadioGroup>
      {error && <FormHelperText sx={{ mx: 0 }}>{error}</FormHelperText>}
    </FormControl>
  );
}
