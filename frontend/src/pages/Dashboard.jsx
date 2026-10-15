import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Band } from '../components/Layout.jsx';
import {
  ActivityArea,
  CampaignBars,
  ChartCard,
  DeliveryDonut,
  ListPie,
  RateGauge,
} from '../components/charts.jsx';
import {
  Card,
  ErrorNote,
  LoadingBlock,
  SectionHeading,
  StatCard,
  useAsync,
  useInterval,
} from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { formatNumber } from '../lib/format.js';

const RANGE_OPTIONS = [7, 14, 30];

export default function Dashboard() {
  const [days, setDays] = useState(14);

  const stats = useAsync(() => api.dashboard.stats(), []);
  const breakdown = useAsync(() => api.dashboard.breakdown(), []);
  const performance = useAsync(() => api.dashboard.campaignPerformance(6), []);
  const series = useAsync(() => api.dashboard.timeseries(days), [days]);

  const hasActive = Boolean(stats.data?.campaigns?.active);

  // Follow live campaigns without hammering the API when nothing is running.
  const refreshLive = useCallback(() => {
    stats.refetch();
  }, [stats.refetch]);

  useInterval(refreshLive, 6000, hasActive);

  const s = stats.data;
  const deliveryData = (breakdown.data?.deliveryStatus || []).filter((item) => item.value > 0);
  const deliveryTotal = deliveryData.reduce((sum, item) => sum + item.value, 0);
  const listData = breakdown.data?.contactsByList || [];

  return (
    <>
      {/* ------------------------------------------------------- Top Header & Quick Actions */}
      <Band tight>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-[26px] font-bold tracking-tight text-slate-900">
                Dashboard Overview
              </h1>
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-[#00a859] border border-emerald-200">
                Live Telemetry
              </span>
            </div>
            <p className="mt-1 font-text text-[13.5px] text-slate-500">
              Real-time campaign delivery, recipient engagement, and Brevo relay statistics.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Link to="/send" className="btn-emerald btn-sm shadow-sm">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              Start a Send
            </Link>
            <Link to="/templates/new" className="btn-secondary btn-sm shadow-sm">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Create a Mail
            </Link>
          </div>
        </div>

        <ErrorNote error={stats.error} onRetry={stats.refetch} />

        {stats.loading && !s ? (
          <Card className="p-8">
            <LoadingBlock label="Loading campaign metrics…" />
          </Card>
        ) : (
          <>
            {/* -------------------------------------------------------------
                Interactive Stat Cards Grid with Emerald Green Hover Effect
                (Hovered card scales & glows green, neighboring cards blur & scale down)
                ------------------------------------------------------------- */}
            <div className="interactive-cards-grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Emails Delivered"
                value={s?.emails?.sent ?? 0}
                delta={s?.trend?.changePercent}
                hint="vs previous 30 days"
                accent="#00c269"
                icon={
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                }
              />
              <StatCard
                label="Audience Contacts"
                value={s?.contacts?.subscribed ?? 0}
                hint={`${formatNumber(s?.contacts?.total ?? 0)} total, ${formatNumber(
                  s?.contacts?.unsubscribed ?? 0,
                )} opted out`}
                accent="#00c269"
                icon={
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                }
              />
              <StatCard
                label="Open Rate"
                value={`${s?.rates?.open ?? 0}%`}
                hint={`${formatNumber(s?.engagement?.uniqueOpens ?? 0)} unique opens`}
                accent="#00c269"
                icon={
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                }
              />
              <StatCard
                label="Campaigns Executed"
                value={s?.campaigns?.total ?? 0}
                hint={
                  s?.campaigns?.active
                    ? `${s.campaigns.active} active now`
                    : `${formatNumber(s?.templates ?? 0)} templates configured`
                }
                accent={s?.campaigns?.active ? '#00c269' : '#64748b'}
                icon={
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                }
              />
              <StatCard
                label="Delivery Rate"
                value={`${s?.rates?.delivery ?? 0}%`}
                hint={`${formatNumber(s?.emails?.failed ?? 0)} failed deliveries`}
                accent="#00c269"
                icon={
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                }
              />
              <StatCard
                label="Click-Through Rate"
                value={`${s?.rates?.click ?? 0}%`}
                hint={`${formatNumber(s?.engagement?.uniqueClicks ?? 0)} unique link clicks`}
                accent="#00c269"
                icon={
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                }
              />
              <StatCard
                label="Queued For Dispatch"
                value={s?.emails?.queued ?? 0}
                hint={s?.emails?.queued ? 'Actively dispatching' : 'Queue idle'}
                accent="#3b82f6"
                icon={
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                }
              />
              <StatCard
                label="Unsubscribe Rate"
                value={`${s?.rates?.unsubscribe ?? 0}%`}
                hint={`${formatNumber(s?.engagement?.unsubscribes ?? 0)} total opt-outs`}
                accent="#f59e0b"
                icon={
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                }
              />
            </div>
          </>
        )}
      </Band>

      {/* ----------------------------------------------------------- charts */}
      <Band tight>
        <SectionHeading
          sub="Daily dispatch volume, recipient engagement, and delivery breakdown."
          action={
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={days === option ? 'btn-pill-tab-active !py-1 !px-3 !text-[12px]' : 'btn-pill-tab !bg-transparent !py-1 !px-3 !text-[12px]'}
                  onClick={() => setDays(option)}
                >
                  {option}d
                </button>
              ))}
            </div>
          }
        >
          Sending Activity
        </SectionHeading>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <ChartCard
            title="Daily Send Volume"
            sub={`Dispatched, opened, and bounced over the last ${days} days`}
            height={300}
            empty={
              series.loading
                ? 'Loading telemetry…'
                : !series.data?.series?.some((row) => row.sent || row.opened || row.failed)
                  ? 'No campaign dispatches within this window.'
                  : null
            }
          >
            <ActivityArea series={series.data?.series || []} />
          </ChartCard>

          <ChartCard
            title="Delivery Breakdown"
            sub="Status distribution of historical messages"
            height={300}
            empty={
              breakdown.loading ? 'Loading telemetry…' : !deliveryTotal ? 'No messages queued yet.' : null
            }
          >
            <DeliveryDonut data={deliveryData} total={deliveryTotal} />
          </ChartCard>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <ChartCard
            title="Campaign Performance"
            sub="Delivered volume vs unique opens and clicks for recent sends"
            height={300}
            empty={
              performance.loading
                ? 'Loading performance metrics…'
                : !performance.data?.length
                  ? 'Run a campaign to populate this telemetry.'
                  : null
            }
          >
            <CampaignBars data={performance.data || []} />
          </ChartCard>

          <ChartCard
            title="Contacts by Audience List"
            sub="Audience volume breakdown"
            height={300}
            empty={breakdown.loading ? 'Loading…' : !listData.length ? 'Upload an audience list to begin.' : null}
          >
            <ListPie data={listData} />
          </ChartCard>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          {[
            { label: 'Delivery Rate', value: s?.rates?.delivery ?? 0, tone: '#00c269' },
            { label: 'Open Rate', value: s?.rates?.open ?? 0, tone: '#00a859' },
            { label: 'Click-to-Open', value: s?.rates?.clickToOpen ?? 0, tone: '#f59e0b' },
          ].map((gauge) => (
            <Card key={gauge.label} className="p-6 border border-slate-200">
              <div className="h-[160px]">
                <RateGauge value={gauge.value} label={gauge.label} tone={gauge.tone} />
              </div>
            </Card>
          ))}
        </div>
      </Band>
    </>
  );
}
