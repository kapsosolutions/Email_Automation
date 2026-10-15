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
  Badge,
  Card,
  ErrorNote,
  LoadingBlock,
  ProgressBar,
  SectionHeading,
  StatCard,
  Table,
  useAsync,
  useInterval,
} from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { formatNumber, formatRelative, toneFor } from '../lib/format.js';

const RANGE_OPTIONS = [7, 14, 30];

export default function Dashboard() {
  const [days, setDays] = useState(14);

  const stats = useAsync(() => api.dashboard.stats(), []);
  const breakdown = useAsync(() => api.dashboard.breakdown(), []);
  const performance = useAsync(() => api.dashboard.campaignPerformance(6), []);
  const recent = useAsync(() => api.dashboard.recent(), []);
  const series = useAsync(() => api.dashboard.timeseries(days), [days]);

  const hasActive = Boolean(stats.data?.campaigns?.active);

  // Follow live campaigns without hammering the API when nothing is running.
  const refreshLive = useCallback(() => {
    stats.refetch();
    recent.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats.refetch, recent.refetch]);

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
                icon="✉"
              />
              <StatCard
                label="Audience Contacts"
                value={s?.contacts?.subscribed ?? 0}
                hint={`${formatNumber(s?.contacts?.total ?? 0)} total, ${formatNumber(
                  s?.contacts?.unsubscribed ?? 0,
                )} opted out`}
                accent="#00c269"
                icon="👥"
              />
              <StatCard
                label="Open Rate"
                value={`${s?.rates?.open ?? 0}%`}
                hint={`${formatNumber(s?.engagement?.uniqueOpens ?? 0)} unique opens`}
                accent="#00c269"
                icon="📬"
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
                icon="⚡"
              />
              <StatCard
                label="Delivery Rate"
                value={`${s?.rates?.delivery ?? 0}%`}
                hint={`${formatNumber(s?.emails?.failed ?? 0)} failed deliveries`}
                accent="#00c269"
                icon="✓"
              />
              <StatCard
                label="Click-Through Rate"
                value={`${s?.rates?.click ?? 0}%`}
                hint={`${formatNumber(s?.engagement?.uniqueClicks ?? 0)} unique link clicks`}
                accent="#00c269"
                icon="🔗"
              />
              <StatCard
                label="Queued For Dispatch"
                value={s?.emails?.queued ?? 0}
                hint={s?.emails?.queued ? 'Actively dispatching' : 'Queue idle'}
                accent="#3b82f6"
                icon="⏳"
              />
              <StatCard
                label="Unsubscribe Rate"
                value={`${s?.rates?.unsubscribe ?? 0}%`}
                hint={`${formatNumber(s?.engagement?.unsubscribes ?? 0)} total opt-outs`}
                accent="#f59e0b"
                icon="✕"
              />
            </div>
          </>
        )}
      </Band>

      {/* -------------------------------------------------------------
          WATI Custom Parameters / Contact Attributes Showcase
          (Replicating the right-side parameter card from user screenshot)
          ------------------------------------------------------------- */}
      <Band tight>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Contact Custom Parameters Card */}
          <Card className="p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#e8f8f0] text-[#00c269]">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                </span>
                <h3 className="font-display text-[15px] font-bold text-slate-800">
                  Contact Custom Parameters
                </h3>
              </div>
              <span className="flex h-6 w-6 items-center justify-center rounded bg-[#00c269] text-white text-[12px]">
                ✎
              </span>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px]">
                <span className="font-medium text-slate-600">Name</span>
                <span className="font-semibold text-slate-800">Alex Morgan</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px]">
                <span className="font-medium text-slate-600">Language</span>
                <span className="font-semibold text-slate-800">English</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px]">
                <span className="font-medium text-slate-600">Country</span>
                <span className="font-semibold text-slate-800">India / USA</span>
              </div>

              {/* Highlighted WATI Attribute with Green Border and Badge */}
              <div className="relative rounded-lg border-2 border-[#00c269] bg-[#f0fdf4] p-3 space-y-2 transition-all shadow-sm">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="font-mono text-[12px] font-bold text-[#00a859]">last_cart_total_value</span>
                  <span className="font-bold text-slate-900">₹500</span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="font-mono text-[12px] font-bold text-[#00a859]">last_cart_items</span>
                  <span className="font-medium text-slate-800 text-[12px] truncate max-w-[150px]">Clarks Men's Boat...</span>
                </div>
                <div className="absolute -right-3 -top-3 inline-flex items-center gap-1 rounded-full bg-[#00c269] px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                  <span>← Contact Attribute</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between text-[12px] text-slate-500 mb-2">
                <span>Personalization Tags:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700">General Enquiry ×</span>
                <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700">Shipping Enquiry ×</span>
              </div>
            </div>
          </Card>

          {/* Brevo Relay Diagnostic Card */}
          <Card className="p-6 border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#e8f8f0] text-[#00c269]">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                    </svg>
                  </span>
                  <h3 className="font-display text-[15px] font-bold text-slate-800">
                    Relay Health & Throttle
                  </h3>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-[#00a859]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#00c269]" />
                  Active
                </span>
              </div>

              <div className="mt-4 space-y-3 font-text text-[13px]">
                <div className="flex items-center justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">SMTP Host</span>
                  <span className="font-mono text-slate-800 font-semibold">smtp-relay.brevo.com:587</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Sending Throttle</span>
                  <span className="font-semibold text-slate-800">60 emails/min (Jitter: 400ms)</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Concurrency</span>
                  <span className="font-semibold text-slate-800">3 parallel workers</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500">Authenticated Sender</span>
                  <span className="font-mono text-[12px] text-[#00a859] font-bold">zzzverseofficial@gmail.com</span>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-[12px] text-emerald-800 flex items-center gap-2">
              <span>🛡️</span>
              <span>All outgoing emails include One-Click Unsubscribe headers and DKIM alignment.</span>
            </div>
          </Card>

          {/* Quick Dispatch Card */}
          <Card className="p-6 border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#e8f8f0] text-[#00c269]">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </span>
                  <h3 className="font-display text-[15px] font-bold text-slate-800">
                    Quick Send Action
                  </h3>
                </div>
                <span className="text-[12px] font-semibold text-slate-400">Step 1 of 3</span>
              </div>

              <p className="mt-3 font-text text-[13px] text-slate-600 leading-relaxed">
                Upload contacts via CSV/XLSX, choose your personalized email template, and let the Brevo relay stream messages.
              </p>

              <div className="mt-4 space-y-2 text-[12.5px] text-slate-700">
                <div className="flex items-center gap-2">
                  <span className="text-[#00c269] font-bold">✓</span>
                  <span>Automatic CSV & XLSX header detection</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#00c269] font-bold">✓</span>
                  <span>Loose placeholder matching (<code className="text-[#00a859]">{'{name}'}</code>, <code className="text-[#00a859]">{'{company}'}</code>)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#00c269] font-bold">✓</span>
                  <span>Supersonic dispatch animations & real-time telemetry</span>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <Link to="/send" className="btn-emerald w-full justify-center shadow-sm">
                Open Send Console →
              </Link>
            </div>
          </Card>
        </div>
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

      {/* --------------------------------------------------- recent tables */}
      <Band tight>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-6 border border-slate-200">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-display text-[17px] font-bold text-slate-900">Recent Campaigns</h3>
                <p className="font-text text-[13px] text-slate-500">Latest executed broadcasts</p>
              </div>
              <Link to="/campaigns" className="font-display text-[13px] font-semibold text-[#00a859] hover:underline">
                View all →
              </Link>
            </div>
            {recent.loading && !recent.data ? (
              <LoadingBlock />
            ) : (
              <div className="pt-2">
                <Table
                  head={['Campaign', 'Status', 'Progress']}
                  empty={!recent.data?.campaigns?.length ? 'No campaigns executed yet.' : null}
                >
                  {(recent.data?.campaigns || []).map((campaign) => (
                    <tr key={campaign._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="table-cell">
                        <Link
                          to={`/campaigns/${campaign._id}`}
                          className="font-display text-[14px] font-semibold text-slate-900 hover:text-[#00c269] transition-colors"
                        >
                          {campaign.name}
                        </Link>
                        <p className="font-text text-[12px] text-slate-500 mt-0.5">
                          {campaign.list?.name || 'list removed'} ·{' '}
                          {formatRelative(campaign.createdAt)}
                        </p>
                      </td>
                      <td className="table-cell">
                        <Badge status={campaign.status} />
                      </td>
                      <td className="table-cell w-40">
                        <ProgressBar
                          value={campaign.progress}
                          tone={toneFor(campaign.status).color}
                        />
                        <p className="mt-1 font-text text-[11px] text-slate-500">
                          {formatNumber(campaign.stats?.sent || 0)} /{' '}
                          {formatNumber(campaign.stats?.total || 0)}
                        </p>
                      </td>
                    </tr>
                  ))}
                </Table>
              </div>
            )}
          </Card>

          <Card className="p-6 border border-slate-200">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-display text-[17px] font-bold text-slate-900">Live Activity Stream</h3>
                <p className="font-text text-[13px] text-slate-500">Real-time message transmissions</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 font-display text-[11px] font-semibold text-[#00a859] border border-emerald-200">
                <span className={`h-2 w-2 rounded-full ${hasActive ? 'bg-[#00c269] animate-pulse' : 'bg-slate-400'}`} />
                {hasActive ? 'Live Streaming' : 'Queue Idle'}
              </span>
            </div>
            {recent.loading && !recent.data ? (
              <LoadingBlock />
            ) : (
              <div className="pt-2">
                <Table
                  head={['Recipient', 'Status', 'Timestamp']}
                  empty={!recent.data?.activity?.length ? 'No transmission logs recorded yet.' : null}
                >
                  {(recent.data?.activity || []).map((log) => (
                    <tr key={log._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="table-cell">
                        <span className="font-text text-[13.5px] font-medium text-slate-900">{log.email}</span>
                        <p className="truncate font-text text-[12px] text-slate-500 mt-0.5 max-w-[200px]">
                          {log.campaign?.name || log.subject || '—'}
                        </p>
                      </td>
                      <td className="table-cell">
                        <Badge status={log.status} />
                        {log.error ? (
                          <p
                            className="mt-1 max-w-[180px] truncate font-text text-[11px] text-red-500"
                            title={log.error}
                          >
                            {log.error}
                          </p>
                        ) : log.opens ? (
                          <p className="mt-1 font-text text-[11px] text-slate-500">
                            {log.opens} open{log.opens > 1 ? 's' : ''}
                            {log.clicks ? `, ${log.clicks} click${log.clicks > 1 ? 's' : ''}` : ''}
                          </p>
                        ) : null}
                      </td>
                      <td className="table-cell whitespace-nowrap font-text text-[12px] text-slate-500">
                        {formatRelative(log.sentAt || log.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </Table>
              </div>
            )}
          </Card>
        </div>
      </Band>
    </>
  );
}
