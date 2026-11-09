import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatShortDate } from '../utils/date';
import { SLOTS } from '../utils/slots';

// one colour per time slot
const COLORS = {
  morning: '#0f766e',
  after_breakfast: '#d97706',
  after_lunch: '#7c3aed',
  after_dinner: '#be185d',
};

// The report sends one row per reading. The chart wants one row per day
// with a value for each slot: { date, morning: 98, after_lunch: 140 }
function toChartData(readings) {
  const days = {};

  readings.forEach((reading) => {
    const date = String(reading.reading_date).slice(0, 10);

    if (!days[date]) days[date] = { date };
    days[date][reading.slot] = reading.value;
  });

  return Object.values(days);
}

// keep the legend and tooltip in the order of the day, not alphabetical
function slotOrder(item) {
  return SLOTS.findIndex((slot) => slot.value === item.dataKey);
}

function MonthChart({ readings }) {
  if (readings.length === 0) {
    return <p className="empty">No readings this month yet, so there is nothing to plot.</p>;
  }

  const data = toChartData(readings);

  return (
    <div
      className="chart-box"
      role="img"
      aria-label="Line chart of blood glucose readings this month, one line per time slot"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 28, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dce4e2" />

          <XAxis
            dataKey="date"
            tickFormatter={formatShortDate}
            tick={{ fontSize: 12 }}
            minTickGap={20}
          />

          <YAxis
            domain={['dataMin - 10', 'dataMax + 10']}
            allowDecimals={false}
            tick={{ fontSize: 12 }}
            width={40}
          />

          <Tooltip labelFormatter={formatShortDate} itemSorter={slotOrder} />
          <Legend itemSorter={slotOrder} />

          {SLOTS.map((slot) => (
            <Line
              key={slot.value}
              type="monotone"
              dataKey={slot.value}
              name={slot.label}
              stroke={COLORS[slot.value]}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default MonthChart;