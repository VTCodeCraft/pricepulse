import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ReactElement } from 'react';
import { formatPrice } from '../../../lib/utils/format';
import type { TrackedProduct } from '../../../types/product';

type OptionRowProps = {
  control: ReactElement; // a Radio or a Checkbox
  value?: string; // for a radio group
  label: string;
  item: TrackedProduct | undefined; // the option's tracking record, when it is tracked
  selected: boolean;
  disabled?: boolean;
  alreadyTracked?: boolean; // wording when a tracked option cannot be chosen again
};

// One option as a bordered row: its label and, when tracked, the latest price. The chosen row also gets a tint, on
// top of the radio dot or tick.
export function OptionRow({ control, value, label, item, selected, disabled, alreadyTracked = false }: OptionRowProps) {
  return (
    <FormControlLabel
      value={value}
      disabled={disabled}
      control={control}
      label={
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between', minWidth: 0 }}>
          <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
            {label}
          </Typography>
          {item && (
            <Typography variant="caption" noWrap sx={{ color: 'text.secondary', flexShrink: 0 }}>
              {alreadyTracked ? 'Already tracked' : 'Tracked'}
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
}
