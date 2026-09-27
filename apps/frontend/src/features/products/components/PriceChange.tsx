import ArrowDownward from '@mui/icons-material/ArrowDownward';
import ArrowUpward from '@mui/icons-material/ArrowUpward';
import Stack from '@mui/material/Stack';
import { formatSignedPercent } from '../../../lib/utils/format';

// A drop is good news for a buyer: green with a down arrow. The arrow and sign carry the meaning, not the colour.
export function PriceChange({ pct }: { pct: number | null }) {
  if (pct === null) return <>—</>;
  const Icon = pct < 0 ? ArrowDownward : ArrowUpward;
  return (
    <Stack
      direction="row"
      spacing={0.25}
      component="span"
      sx={{ alignItems: 'center', fontVariantNumeric: 'tabular-nums', color: pct < 0 ? 'success.main' : pct > 0 ? 'error.main' : 'text.secondary' }}
    >
      {pct !== 0 && <Icon sx={{ fontSize: 14 }} aria-hidden />}
      <span>{formatSignedPercent(pct)}</span>
    </Stack>
  );
}
