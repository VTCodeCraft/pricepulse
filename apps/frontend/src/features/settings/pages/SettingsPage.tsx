import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import { useColorScheme } from '@mui/material/styles';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { PageHeader } from '../../../components/common/PageHeader';

type Mode = 'light' | 'dark' | 'system';

export function SettingsPage() {
  const { mode, setMode } = useColorScheme();

  return (
    <>
      <PageHeader title="Settings" />
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}>
            <div>
              <Typography variant="h3" component="h2">
                Appearance
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                System follows your operating system. The choice is saved in this browser.
              </Typography>
            </div>
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
          </Stack>
        </CardContent>
      </Card>
    </>
  );
}
