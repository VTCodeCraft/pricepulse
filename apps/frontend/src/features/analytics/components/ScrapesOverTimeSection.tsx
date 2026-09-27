import BarChartOutlined from '@mui/icons-material/BarChartOutlined';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { addHours, format } from 'date-fns';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EmptyState } from '../../../components/common/EmptyState';
import { Section } from '../../../components/common/Section';
import { fonts } from '../../../theme/theme';
import type { AttemptBucket, attemptsOverTime } from '../analytics';

// Ink for the usual case, the accent for retries, red for failures: the eye goes to what needed attention.
const SERIES = [
  { key: 'success', name: 'Success', color: 'text' },
  { key: 'retried', name: 'Retried', color: 'accent' },
  { key: 'failed', name: 'Failed', color: 'error' },
] as const;

type ScrapesOverTimeSectionProps = { data: ReturnType<typeof attemptsOverTime>; rangeDescription: string };

export function ScrapesOverTimeSection({ data: { unit, buckets }, rangeDescription }: ScrapesOverTimeSectionProps) {
  const { palette } = useTheme().vars;
  const tickLabel = (start: number) => format(start, unit === 'day' || new Date(start).getHours() === 0 ? 'd MMM' : 'HH:mm');
  const bucketLabel = (start: number) =>
    unit === 'day' ? format(start, 'EEE d MMM yyyy') : `${format(start, 'd MMM, HH:mm')}–${format(addHours(start, 1), 'HH:mm')}`;
  const total = (bucket: AttemptBucket) => bucket.success + bucket.retried + bucket.failed;
  const axis = { stroke: palette.divider, tick: { fill: palette.text.secondary, fontSize: 11, fontFamily: fonts.mono }, tickLine: false };
  const colors = { text: palette.text.primary, accent: palette.primary.main, error: palette.error.main };
  const busiest = buckets.reduce<AttemptBucket | null>((best, bucket) => (best && total(best) >= total(bucket) ? best : bucket), null);

  return (
    <Section title="Scrapes over time" description={`Finished attempts per ${unit} in ${rangeDescription}, by outcome. Times are local.`}>
      {buckets.length === 0 ? (
        <EmptyState icon={BarChartOutlined} title={`No finished attempts in ${rangeDescription}`} />
      ) : (
        <Box sx={{ height: { xs: 260, sm: 300 } }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={buckets}
              margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              title={`Scrape attempts per ${unit}, ${rangeDescription}`}
              desc={`${buckets.reduce((sum, bucket) => sum + total(bucket), 0)} finished attempts from ${bucketLabel(buckets[0].start)} to ${bucketLabel(buckets[buckets.length - 1].start)}${busiest ? `; busiest ${bucketLabel(busiest.start)} with ${total(busiest)}` : ''}.`}
            >
              <CartesianGrid vertical={false} stroke={palette.divider} />
              <XAxis dataKey="start" tickFormatter={tickLabel} minTickGap={20} {...axis} />
              <YAxis allowDecimals={false} width="auto" axisLine={false} {...axis} />
              <Tooltip
                cursor={{ fill: palette.action.hover }}
                content={({ active, label }) => {
                  const bucket = active ? buckets.find(b => b.start === label) : undefined;
                  return bucket ? (
                    <Paper variant="outlined" sx={{ px: 1.5, py: 1 }}>
                      <Typography variant="subtitle2" component="p">
                        {bucketLabel(bucket.start)}
                      </Typography>
                      {SERIES.map(series => (
                        <Typography key={series.key} variant="caption" component="p" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          {series.name}: {bucket[series.key]}
                        </Typography>
                      ))}
                    </Paper>
                  ) : null;
                }}
              />
              <Legend itemSorter={item => SERIES.findIndex(series => series.key === item.dataKey)} iconType="square" iconSize={8} wrapperStyle={{ fontSize: 11, fontFamily: fonts.mono, color: palette.text.secondary }} />
              {SERIES.map(series => (
                <Bar key={series.key} dataKey={series.key} name={series.name} stackId="outcome" fill={colors[series.color]} isAnimationActive={false} maxBarSize={22} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Box>
      )}
    </Section>
  );
}
