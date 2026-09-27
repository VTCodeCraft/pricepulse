import type { SvgIconComponent } from '@mui/icons-material';
import AddOutlined from '@mui/icons-material/AddOutlined';
import DarkModeOutlined from '@mui/icons-material/DarkModeOutlined';
import DownloadOutlined from '@mui/icons-material/DownloadOutlined';
import LightModeOutlined from '@mui/icons-material/LightModeOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { lazy, Suspense, useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCsvExport } from '../../features/scraping/hooks/useCsvExport';
import { useThemeToggle } from '../../theme/useThemeToggle';
import { matchCommands, moveActive, type PaletteCommand } from './commands';
import { NAV_ITEMS } from './navigation';

// Loaded only when "Track Product" is chosen, so the form libraries stay out of the first load.
const TrackProductDialog = lazy(() => import('../../features/products/components/TrackProductDialog').then(m => ({ default: m.TrackProductDialog })));

type Command = PaletteCommand & { group: 'Go to' | 'Actions'; icon: SvgIconComponent; hint?: string; run: () => void };

type CommandPaletteProps = { open: boolean; onOpenChange: (open: boolean) => void };

// Opened with Ctrl+K / ⌘K (see AppLayout) or the header button. There is deliberately no "run a full scrape": that
// endpoint needs the cron secret and is never called from the browser.
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const theme = useThemeToggle();
  const exportCsv = useCsvExport();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [tracking, setTracking] = useState(false);
  const [trackLoaded, setTrackLoaded] = useState(false);
  const listId = useId();

  const commands: Command[] = [
    ...NAV_ITEMS.map(item => ({ id: item.to, label: item.label, keywords: 'go to page open', group: 'Go to' as const, icon: item.icon, run: () => navigate(item.to) })),
    {
      id: 'track',
      label: 'Track Product',
      keywords: 'add new option search catalogue',
      group: 'Actions',
      icon: AddOutlined,
      run: () => {
        setTrackLoaded(true);
        setTracking(true);
      },
    },
    {
      id: 'theme',
      label: 'Toggle Theme',
      keywords: 'dark light mode appearance colour color',
      group: 'Actions',
      icon: theme.isDark ? LightModeOutlined : DarkModeOutlined,
      hint: theme.isDark ? 'Switch to light' : 'Switch to dark',
      run: theme.toggle,
    },
    { id: 'export', label: 'Export CSV', keywords: 'download scrape history attempts', group: 'Actions', icon: DownloadOutlined, run: () => exportCsv.mutate() },
  ];
  const shown = matchCommands(commands, query);
  const activeIndex = Math.min(active, Math.max(shown.length - 1, 0));
  const optionId = (command: Command) => `${listId}-${command.id.replace(/\W/g, '') || 'home'}`;

  const choose = (command: Command) => {
    onOpenChange(false);
    command.run();
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={() => onOpenChange(false)}
        fullWidth
        maxWidth="sm"
        slotProps={{
          paper: { 'aria-label': 'Command palette', sx: { alignSelf: 'flex-start', mt: { xs: 2, sm: '12vh' }, mx: 2, width: 'calc(100% - 32px)' } },
          transition: {
            onExited: () => {
              setQuery('');
              setActive(0);
            },
          },
        }}
      >
        <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <TextField
            autoFocus
            fullWidth
            size="small"
            placeholder="Type a page or an action"
            value={query}
            onChange={event => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={event => {
              if (event.key === 'Enter' && shown[activeIndex]) {
                event.preventDefault();
                choose(shown[activeIndex]);
              } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
                event.preventDefault();
                setActive(moveActive(activeIndex, event.key, shown.length));
              }
            }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlined fontSize="small" />
                  </InputAdornment>
                ),
              },
              htmlInput: {
                role: 'combobox',
                'aria-label': 'Command',
                'aria-expanded': true,
                'aria-controls': listId,
                'aria-autocomplete': 'list',
                'aria-activedescendant': shown[activeIndex] ? optionId(shown[activeIndex]) : undefined,
              },
            }}
          />
        </Box>
        <List id={listId} role="listbox" aria-label="Commands" dense sx={{ p: 1, maxHeight: '50vh', overflowY: 'auto' }}>
          {shown.map((command, index) => (
            <ListItemButton
              key={command.id}
              id={optionId(command)}
              role="option"
              aria-selected={index === activeIndex}
              selected={index === activeIndex}
              tabIndex={-1}
              onMouseMove={() => setActive(index)}
              onClick={() => choose(command)}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <command.icon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={command.label} secondary={command.hint} />
              <Typography variant="caption" sx={{ color: 'text.secondary', ml: 2 }}>
                {command.group}
              </Typography>
            </ListItemButton>
          ))}
        </List>
        {shown.length === 0 && (
          <Typography role="status" variant="body2" sx={{ color: 'text.secondary', px: 3, pb: 3 }}>
            No command matches “{query}”.
          </Typography>
        )}
      </Dialog>
      {trackLoaded && (
        <Suspense fallback={null}>
          <TrackProductDialog open={tracking} onClose={() => setTracking(false)} />
        </Suspense>
      )}
    </>
  );
}
