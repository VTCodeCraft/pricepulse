import SearchOutlined from '@mui/icons-material/SearchOutlined';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { TimeRangeToggle } from '../../../components/common/TimeRangeToggle';
import type { TrackedProduct } from '../../../types/product';
import type { ScrapeOutcome } from '../../../types/scrape';
import { NO_FILTERS, type LogFilters as Filters } from '../scrapeLog';

const OUTCOMES: { value: ScrapeOutcome; label: string }[] = [
  { value: 'success', label: 'Success' },
  { value: 'retried', label: 'Retried' },
  { value: 'failed', label: 'Failed' },
];

// Shows "All products" / "All outcomes" when nothing is chosen, instead of an empty field.
const showAllOption = { select: { displayEmpty: true }, inputLabel: { shrink: true } };

type LogFiltersProps = { filters: Filters; onChange: (filters: Filters) => void; options: TrackedProduct[] };

export function LogFilters({ filters, onChange, options }: LogFiltersProps) {
  const set = (changes: Partial<Filters>) => onChange({ ...filters, ...changes });
  const active = filters.trackedId !== null || filters.outcome !== null || filters.range !== NO_FILTERS.range || filters.search !== '';

  return (
    <Stack direction="row" useFlexGap spacing={1.5} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
      <TextField
        select
        size="small"
        label="Product"
        value={filters.trackedId ?? ''}
        onChange={event => set({ trackedId: event.target.value === '' ? null : Number(event.target.value) })}
        sx={{ width: { xs: '100%', sm: 260 } }}
        slotProps={showAllOption}
      >
        <MenuItem value="">All products</MenuItem>
        {options.map(option => (
          <MenuItem key={option.id} value={option.id}>
            {option.productName} · {option.optionLabel}
            {!option.isActive && ' (no longer tracked)'}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        size="small"
        label="Outcome"
        value={filters.outcome ?? ''}
        onChange={event => set({ outcome: OUTCOMES.find(outcome => outcome.value === event.target.value)?.value ?? null })}
        sx={{ width: { xs: 'calc(50% - 6px)', sm: 150 } }}
        slotProps={showAllOption}
      >
        <MenuItem value="">All outcomes</MenuItem>
        {OUTCOMES.map(outcome => (
          <MenuItem key={outcome.value} value={outcome.value}>
            {outcome.label}
          </MenuItem>
        ))}
      </TextField>
      <TimeRangeToggle value={filters.range} onChange={range => set({ range })} />
      <TextField
        size="small"
        type="search"
        label="Search"
        placeholder="Product, option, error, #id"
        value={filters.search}
        onChange={event => set({ search: event.target.value })}
        sx={{ flex: '1 1 220px', minWidth: 0 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchOutlined fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />
      {active && (
        <Button size="small" onClick={() => onChange(NO_FILTERS)}>
          Clear filters
        </Button>
      )}
    </Stack>
  );
}
