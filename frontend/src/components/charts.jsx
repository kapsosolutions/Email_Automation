import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, EmptyState } from './ui.jsx';
import { CHART_COLORS, formatNumber } from '../lib/format.js';

const AXIS = {
  stroke: '#e6e6e8',
  tick: { fill: '#707070', fontSize: 11.5, fontFamily: '-apple-system, SF Pro Text, sans-serif' },
};

/** Tooltip styled to Apple specifications: rounded-2xl, hairline edge, flat white. */
function ChartTooltip({ active, payload, label, suffix = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[16px] border border-control-gray bg-white p-3 min-w-[140px]">
      {label ? (
        <p className="mb-1.5 font-display text-[11.5px] font-semibold uppercase tracking-wider text-slate">
          {label}
        </p>
      ) : null}
      <div className="space-y-1">
        {payload.map((entry) => (
          <p key={entry.name} className="flex items-center justify-between gap-3 font-text text-[13px] text-steel">
            <span className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color || entry.payload?.fill }}
              />
              <span className="capitalize text-ink">{entry.name}</span>
            </span>
            <span className="font-display font-bold text-ink-deep">
              {formatNumber(entry.value)}
              {suffix}
            </span>
          </p>
        ))}
      </div>
    </div>
  );
}

export function ChartCard({ title, sub, action, children, height = 300, empty }) {
  return (
    <Card className="flex flex-col p-7">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-[20px] font-medium tracking-tight text-ink-deep">{title}</h3>
          {sub ? <p className="mt-1 font-text text-[14px] font-light text-steel leading-relaxed">{sub}</p> : null}
        </div>
        {action}
      </div>
      {empty ? (
        <div className="flex flex-1 items-center justify-center" style={{ minHeight: height }}>
          <p className="font-text text-[14px] text-stone">{empty}</p>
        </div>
      ) : (
        <div style={{ height }}>{children}</div>
      )}
    </Card>
  );
}

/**
 * Delivery status donut with Meta colors.
 */
export function DeliveryDonut({ data, total }) {
  const palette = {
    sent: '#31a24c',
    failed: '#e41e3f',
    queued: '#0091ff',
    sending: '#0064e0',
    skipped: '#dee3e9',
    bounced: '#f7b928',
  };

  return (
    <div className="relative h-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="86%"
            paddingAngle={3}
            stroke="#ffffff"
            strokeWidth={3}
          >
            {data.map((entry) => (
              <Cell key={entry.key} fill={palette[entry.key] || '#5d6c7b'} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            iconSize={8}
            formatter={(value) => (
              <span className="font-display text-[12px] font-medium text-steel">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-9">
        <span className="font-display text-[30px] font-medium leading-none text-ink-deep">
          {formatNumber(total)}
        </span>
        <span className="mt-1 font-display text-[11px] font-bold uppercase tracking-wider text-stone">
          total messages
        </span>
      </div>
    </div>
  );
}

/** Daily send volume with Meta cobalt area and emerald line. */
export function ActivityArea({ series }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="metaSentFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0064e0" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#0064e0" stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#f1f4f7" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" axisLine={{ stroke: AXIS.stroke }} tickLine={false} tick={AXIS.tick} />
        <YAxis axisLine={false} tickLine={false} tick={AXIS.tick} allowDecimals={false} width={48} />
        <Tooltip content={<ChartTooltip />} />
        <Legend
          verticalAlign="top"
          align="right"
          height={28}
          iconType="circle"
          iconSize={8}
          formatter={(value) => <span className="font-display text-[12px] font-medium text-steel">{value}</span>}
        />
        <Area
          type="monotone"
          dataKey="sent"
          name="Sent"
          stroke="#0064e0"
          strokeWidth={2.5}
          fill="url(#metaSentFill)"
          activeDot={{ r: 5, strokeWidth: 0, fill: '#0064e0' }}
        />
        <Line
          type="monotone"
          dataKey="opened"
          name="Opened"
          stroke="#31a24c"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="failed"
          name="Failed"
          stroke="#e41e3f"
          strokeWidth={2}
          strokeDasharray="4 3"
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Grouped bars with rounded pill tops. */
export function CampaignBars({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barGap={5}>
        <CartesianGrid stroke="#f1f4f7" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="name"
          axisLine={{ stroke: AXIS.stroke }}
          tickLine={false}
          tick={{ ...AXIS.tick, fontSize: 11 }}
          interval={0}
          angle={-15}
          textAnchor="end"
          height={56}
        />
        <YAxis axisLine={false} tickLine={false} tick={AXIS.tick} allowDecimals={false} width={48} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f1f4f7' }} />
        <Legend
          verticalAlign="top"
          align="right"
          height={28}
          iconType="circle"
          iconSize={8}
          formatter={(value) => <span className="font-display text-[12px] font-medium text-steel">{value}</span>}
        />
        <Bar dataKey="sent" name="Sent" fill="#0064e0" radius={[6, 6, 0, 0]} maxBarSize={22} />
        <Bar dataKey="opened" name="Opened" fill="#0091ff" radius={[6, 6, 0, 0]} maxBarSize={22} />
        <Bar dataKey="clicked" name="Clicked" fill="#31a24c" radius={[6, 6, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Contacts per list - Meta cobalt and slate spectrum. */
export function ListPie({ data }) {
  const ramp = ['#0064e0', '#007df0', '#0091ff', '#385898', '#1876f2', '#5d6c7b'];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          outerRadius="82%"
          innerRadius="35%"
          paddingAngle={2}
          stroke="#ffffff"
          strokeWidth={2}
          label={({ percent }) => (percent > 0.06 ? `${Math.round(percent * 100)}%` : '')}
          labelLine={false}
        >
          {data.map((entry, index) => (
            <Cell key={entry.name} fill={ramp[index % ramp.length]} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip />} />
        <Legend
          verticalAlign="bottom"
          height={46}
          iconType="circle"
          iconSize={8}
          formatter={(value) => <span className="font-display text-[12px] font-medium text-steel">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

/** Single-metric radial gauge with Meta 100px rounded pills. */
export function RateGauge({ value, label, tone = '#0064e0' }) {
  const data = [{ name: label, value: Math.max(0, Math.min(100, value)), fill: tone }];
  return (
    <div className="relative h-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          data={data}
          innerRadius="70%"
          outerRadius="100%"
          startAngle={90}
          endAngle={-270}
        >
          <RadialBar dataKey="value" cornerRadius={100} background={{ fill: '#f1f4f7' }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[26px] font-medium leading-none text-ink-deep">
          {value}%
        </span>
        <span className="mt-1 font-display text-[11px] font-bold uppercase tracking-wider text-stone">
          {label}
        </span>
      </div>
    </div>
  );
}

export function NoData({ title = 'Nothing to chart yet', body }) {
  return <EmptyState title={title} body={body} icon="◍" />;
}
