import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatPrice, formatTimestamp } from '../../../lib/utils/format';
import type { PricePoint } from '../../../types/scrape';
import { timeTicks } from '../priceHistory';

const HOUR = 3_600_000;

type PriceHistoryChartProps = { points: PricePoint[]; title: string; description: string };

// One dot per validated scrape. Colours come from the theme's CSS variables, so the chart follows light/dark mode.
export function PriceHistoryChart({ points, title, description }: PriceHistoryChartProps) {
  const theme = useTheme();
  const { palette } = theme.vars;
  const data = points.map(point => ({ time: new Date(point.observedAt).getTime(), price: point.price, point }));
  const first = data[0].time;
  const last = data[data.length - 1].time;
  const domain = first === last ? [first - HOUR, last + HOUR] : [first, last];
  const { ticks, label } = timeTicks(domain[0], domain[1]);
  const axis = { stroke: palette.divider, tick: { fill: palette.text.secondary, fontSize: 12 }, tickLine: false };

  return (
    <Box sx={{ height: { xs: 240, sm: 300 }, mx: -1 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 8 }} title={title} desc={description}>
          <CartesianGrid vertical={false} stroke={palette.divider} strokeDasharray="3 3" />
          <XAxis dataKey="time" type="number" domain={domain} ticks={ticks} tickFormatter={label} {...axis} />
          <YAxis width="auto" domain={['auto', 'auto']} tickFormatter={price => formatPrice(price)} axisLine={false} {...axis} />
          <Tooltip
            cursor={{ stroke: palette.divider }}
            content={({ active, label }) => {
              const datum = active ? data.find(d => d.time === label) : undefined;
              return datum ? (
                <Paper variant="outlined" sx={{ px: 1.5, py: 1 }}>
                  <Typography variant="subtitle2" component="p" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatPrice(datum.price, datum.point.currency)}
                  </Typography>
                  <Typography variant="caption" component="p" sx={{ color: 'text.secondary' }}>
                    {formatTimestamp(datum.point.observedAt)}
                  </Typography>
                </Paper>
              ) : null;
            }}
          />
          <Line
            type="linear"
            dataKey="price"
            name="Price"
            stroke={palette.primary.main}
            strokeWidth={2}
            dot={{ r: 3, fill: palette.primary.main, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
}
