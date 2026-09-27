import Box from '@mui/material/Box';
import { useColorScheme } from '@mui/material/styles';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { PageHeader } from '../../../components/common/PageHeader';
import { SectionCard } from '../../../components/common/SectionCard';
import { NotificationsSection } from '../components/NotificationsSection';
import { ScrapingSection } from '../components/ScrapingSection';
import { SystemSection } from '../components/SystemSection';

type Mode = 'light' | 'dark' | 'system';

// Only settings that work: the colour theme is the one choice made here; the rest reports what the server says.
export function SettingsPage() {
  const { mode, setMode } = useColorScheme();

  return (
    <>
      <PageHeader title="Settings" subtitle="Appearance for this browser, and what the server reports." />
      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'repeat(2, minmax(0, 1fr))' }, alignItems: 'start' }}>
        <SectionCard
          title="Appearance"
          description="System follows your operating system. The choice is saved in this browser."
          action={
            <ToggleButtonGroup
              exclusive
              size="small"
              value={mode ?? 'system'}
              onChange={(_, value: Mode | null) => value && setMode(value)}
              aria-label="Colour theme"
            >
              <ToggleButton value="light">Light</ToggleButton>
              <ToggleButton value="dark">Dark</ToggleButton>
              <ToggleButton value="system">System</ToggleButton>
            </ToggleButtonGroup>
          }
        />
        <SystemSection />
        <ScrapingSection />
        <NotificationsSection />
      </Box>
    </>
  );
}
