import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { TIME_RANGES, type TimeRange } from '../../lib/utils/timeRange';

export function TimeRangeToggle({ value, onChange }: { value: TimeRange; onChange: (range: TimeRange) => void }) {
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={value}
      onChange={(_, next: TimeRange | null) => next && onChange(next)}
      aria-label="Time range"
      sx={{ '& .MuiToggleButton-root': { px: 1.25, py: 0.5, fontWeight: 600, fontSize: '0.75rem' } }}
    >
      {TIME_RANGES.map(range => (
        <ToggleButton key={range.value} value={range.value} title={`Show ${range.description}`}>
          {range.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
