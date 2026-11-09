import { useState, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { SegmentedControl } from './ui';

// Literal values (not CSS variables) because SVG attributes are the safest place for plain colours.
// They mirror tokens.css and were validated for the dark surface with the palette validator.
export const COLORS = {
  s1: '#3987e5',
  s2: '#d95926',
  s3: '#199e70',
  s4: '#c98500',
  s5: '#d55181',
  s6: '#008300',
  s7: '#9085e9',
  s8: '#e66767',
  accent: '#35d07f',
  text3: '#7f958b',
  text2: '#b4c4bc',
  line: '#22342d',
  lineStrong: '#2f463c',
  surface: '#111c18',
} as const;

export const SERIES_ORDER = [COLORS.s1, COLORS.s2, COLORS.s3, COLORS.s4, COLORS.s5, COLORS.s6, COLORS.s7, COLORS.s8];

export interface Series {
  key: string;
  label: string;
  color: string;
}

export interface TableView {
  columns: string[];
  rows: (string | number | null)[][];
}

/** Title, legend (always shown for 2+ series) and a table view of the same data for accessibility. */
export function ChartFrame({
  title,
  subtitle,
  series,
  table,
  controls,
  children,
  height = 260,
}: {
  title: string;
  subtitle?: ReactNode;
  series?: Series[];
  table?: TableView;
  controls?: ReactNode;
  children: ReactNode;
  height?: number;
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  return (
    <section className="panel chart-frame">
      <div className="panel-head chart-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="chart-sub">{subtitle}</p>}
        </div>
        <div className="row chart-tools">
          {controls}
          {table && (
            <SegmentedControl
              label={`${title} view`}
              value={view}
              onChange={setView}
              options={[
                { value: 'chart', label: 'Chart' },
                { value: 'table', label: 'Table' },
              ]}
            />
          )}
        </div>
      </div>
      <div className="panel-body">
        {series && series.length > 1 && view === 'chart' && (
          <ul className="legend">
            {series.map((s) => (
              <li key={s.key}>
                <span className="legend-swatch" style={{ background: s.color }} />
                {s.label}
              </li>
            ))}
          </ul>
        )}
        {view === 'chart' || !table ? (
          <div style={{ height }} className="chart-box">
            {children}
          </div>
        ) : (
          <div className="table-wrap chart-table" style={{ maxHeight: height + 40 }}>
            <table className="table">
              <thead>
                <tr>
                  {table.columns.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r, i) => (
                  <tr key={i}>
                    {r.map((cell, j) => (
                      <td key={j} className={j > 0 ? 'num' : undefined}>
                        {cell ?? '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

const tick = { fill: COLORS.text3, fontSize: 12, fontFamily: 'Barlow, system-ui, sans-serif' };

interface TipPayload {
  name?: string;
  value?: number | string | null;
  color?: string;
  dataKey?: string;
  payload?: Record<string, unknown>;
}

function Tip({
  active,
  payload,
  label,
  series,
  labelFormat,
  valueFormat,
}: {
  active?: boolean;
  payload?: TipPayload[];
  label?: string | number;
  series: Series[];
  labelFormat?: (label: string, row?: Record<string, unknown>) => string;
  valueFormat?: (v: number, key: string) => string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  const rows = payload.filter((p) => p.value !== null && p.value !== undefined);
  if (!rows.length) return null;
  return (
    <div className="chart-tip">
      <div className="chart-tip-title">{labelFormat ? labelFormat(String(label), row) : String(label)}</div>
      {rows.map((p) => {
        const s = series.find((x) => x.key === p.dataKey);
        return (
          <div key={p.dataKey} className="chart-tip-row">
            <span className="legend-swatch" style={{ background: s?.color ?? p.color }} />
            <span>{s?.label ?? p.name}</span>
            <b className="num">{valueFormat ? valueFormat(Number(p.value), String(p.dataKey)) : p.value}</b>
          </div>
        );
      })}
    </div>
  );
}

export function Bars<T extends Record<string, unknown>>({
  data,
  xKey,
  series,
  stacked,
  xFormat,
  labelFormat,
  valueFormat,
  horizontal,
  yMax,
  yAllowDecimals = false,
}: {
  data: T[];
  xKey: string;
  series: Series[];
  stacked?: boolean;
  xFormat?: (v: string) => string;
  labelFormat?: (label: string, row?: Record<string, unknown>) => string;
  valueFormat?: (v: number, key: string) => string;
  horizontal?: boolean;
  yMax?: number;
  yAllowDecimals?: boolean;
}) {
  const many = data.length > 14;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        layout={horizontal ? 'vertical' : 'horizontal'}
        margin={{ top: 6, right: horizontal ? 24 : 6, bottom: 0, left: horizontal ? 8 : -14 }}
        barCategoryGap={many ? '18%' : '30%'}
      >
        <CartesianGrid stroke={COLORS.line} strokeDasharray="3 4" vertical={!!horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" tick={tick} tickLine={false} axisLine={false} allowDecimals={yAllowDecimals} domain={[0, yMax ?? 'auto']} />
            <YAxis type="category" dataKey={xKey} tick={{ ...tick, fill: COLORS.text2 }} tickLine={false} axisLine={false} width={84} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} tick={tick} tickLine={false} axisLine={{ stroke: COLORS.lineStrong }} tickFormatter={xFormat} minTickGap={14} />
            <YAxis tick={tick} tickLine={false} axisLine={false} allowDecimals={yAllowDecimals} domain={[0, yMax ?? 'auto']} />
          </>
        )}
        <Tooltip
          cursor={{ fill: 'rgba(255,255,255,0.045)' }}
          content={<Tip series={series} labelFormat={labelFormat} valueFormat={valueFormat} />}
        />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={s.color}
            stackId={stacked ? 'a' : undefined}
            maxBarSize={horizontal ? 18 : 34}
            // Rounded data end only on the last segment of a stack, anchored flat to the baseline.
            radius={horizontal ? [0, 4, 4, 0] : stacked ? (i === series.length - 1 ? [4, 4, 0, 0] : 0) : [4, 4, 0, 0]}
            stroke={stacked ? COLORS.surface : undefined}
            strokeWidth={stacked ? 1 : 0}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Lines<T extends Record<string, unknown>>({
  data,
  xKey,
  series,
  xFormat,
  labelFormat,
  valueFormat,
  yDomain,
  yAllowDecimals = true,
}: {
  data: T[];
  xKey: string;
  series: Series[];
  xFormat?: (v: string) => string;
  labelFormat?: (label: string, row?: Record<string, unknown>) => string;
  valueFormat?: (v: number, key: string) => string;
  yDomain?: [number | 'auto', number | 'auto'];
  yAllowDecimals?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 10, bottom: 0, left: -14 }}>
        <CartesianGrid stroke={COLORS.line} strokeDasharray="3 4" vertical={false} />
        <XAxis dataKey={xKey} tick={tick} tickLine={false} axisLine={{ stroke: COLORS.lineStrong }} tickFormatter={xFormat} minTickGap={18} />
        <YAxis tick={tick} tickLine={false} axisLine={false} domain={yDomain ?? [0, 'auto']} allowDecimals={yAllowDecimals} />
        <Tooltip
          cursor={{ stroke: COLORS.lineStrong, strokeWidth: 1 }}
          content={<Tip series={series} labelFormat={labelFormat} valueFormat={valueFormat} />}
        />
        {series.map((s) => (
          <Line
            key={s.key}
            type="linear"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            connectNulls
            isAnimationActive={false}
            dot={{ r: 4, fill: s.color, stroke: COLORS.surface, strokeWidth: 2 }}
            activeDot={{ r: 6, fill: s.color, stroke: COLORS.surface, strokeWidth: 2 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
