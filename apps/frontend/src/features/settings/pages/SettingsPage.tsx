import Box from '@mui/material/Box';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { PageHeader } from '../../../components/common/PageHeader';
import { Section } from '../../../components/common/Section';
import { originOf, useThemeToggle } from '../../../theme/useThemeToggle';
import { NotificationsSection } from '../components/NotificationsSection';
import { ScrapingSection } from '../components/ScrapingSection';
import { SystemSection } from '../components/SystemSection';

type Mode = 'light' | 'dark' | 'system';

// Only settings that work: the colour theme is the one choice made here; the rest reports what the server says.
export function SettingsPage() {
  const { mode, changeMode } = useThemeToggle();

  return (
    <>
      <PageHeader eyebrow="System" title="Settings" subtitle="Appearance for this browser, and what the server reports." />
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Section layout="aside" title="Appearance" description="System follows your operating system. The choice is saved in this browser.">
          <ToggleButtonGroup
            exclusive
            size="small"
            value={mode ?? 'system'}
            onChange={(event, value: Mode | null) => value && changeMode(value, originOf(event))}
            aria-label="Colour theme"
          >
            <ToggleButton value="light">Light</ToggleButton>
            <ToggleButton value="dark">Dark</ToggleButton>
            <ToggleButton value="system">System</ToggleButton>
          </ToggleButtonGroup>
        </Section>
        <SystemSection />
        <ScrapingSection />
        <NotificationsSection />
      </Box>
    </>
  );
}
