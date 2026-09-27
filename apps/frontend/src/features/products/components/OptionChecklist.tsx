import Checkbox from '@mui/material/Checkbox';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import FormHelperText from '@mui/material/FormHelperText';
import FormLabel from '@mui/material/FormLabel';
import type { ProductOption, TrackedProduct } from '../../../types/product';
import { OptionRow } from './OptionRow';

type OptionChecklistProps = {
  label: string;
  options: ProductOption[];
  value: string[]; // empty until the user ticks something; nothing is pre-selected
  onChange: (optionIds: string[]) => void;
  tracked: Map<string, TrackedProduct>; // tracked options cannot be chosen again
  error?: string;
};

// Several options at once. "Select all" ticks every option that is not tracked yet.
export function OptionChecklist({ label, options, value, onChange, tracked, error }: OptionChecklistProps) {
  const free = options.filter(option => !tracked.has(option.id)).map(option => option.id);
  const chosen = free.filter(id => value.includes(id));
  const allChosen = free.length > 0 && chosen.length === free.length;
  // Keeps the product's option order whatever order the boxes were ticked in.
  const toggle = (id: string) => onChange(options.map(option => option.id).filter(optionId => (optionId === id ? !value.includes(id) : value.includes(optionId))));

  return (
    <FormControl component="fieldset" error={Boolean(error)} fullWidth>
      <FormLabel component="legend" sx={{ mb: 1, fontSize: '0.8125rem', fontWeight: 600, color: 'text.primary', '&.Mui-focused': { color: 'text.primary' } }}>
        {label}
      </FormLabel>
      {free.length > 1 && (
        <FormControlLabel
          control={<Checkbox size="small" checked={allChosen} indeterminate={chosen.length > 0 && !allChosen} onChange={() => onChange(allChosen ? [] : free)} />}
          label={`Select all untracked (${free.length})`}
          sx={{ m: 0, mb: 1, pl: 0.5, '& .MuiFormControlLabel-label': { fontSize: '0.8125rem', fontWeight: 600 } }}
        />
      )}
      <FormGroup sx={{ gap: 1 }}>
        {options.map(option => (
          <OptionRow
            key={option.id}
            control={<Checkbox size="small" checked={value.includes(option.id)} onChange={() => toggle(option.id)} />}
            label={option.label}
            item={tracked.get(option.id)}
            selected={value.includes(option.id)}
            disabled={tracked.has(option.id)}
            alreadyTracked
          />
        ))}
      </FormGroup>
      {error && <FormHelperText sx={{ mx: 0 }}>{error}</FormHelperText>}
    </FormControl>
  );
}
