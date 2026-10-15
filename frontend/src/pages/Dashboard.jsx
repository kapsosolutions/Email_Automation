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
      {/* ------------------------------------------------------- stat cards */}
      <Band tight>
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-control-gray pb-5">
          <div>
            <h1 className="font-display text-[26px] font-semibold tracking-tight text-ink">Dashboard</h1>
            <p className="mt-0.5 font-text text-[13.5px] text-slate">Live delivery performance and real-time metrics.</p>
          </div>
          <div className="flex items-center gap-2.5">
            <Link to="/send" className="btn-pricing btn-sm">
              Start a send
            </Link>
            <Link to="/templates/new" className="btn-secondary btn-sm">
              Create a mail
            </Link>
          </div>
        </div>

        <ErrorNote error={stats.error} onRetry={stats.refetch} />

        {stats.loading && !s ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Card key={index}>
                <LoadingBlock rows={2} />
              </Card>
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Emails delivered"
                value={s?.emails?.sent ?? 0}
                delta={s?.trend?.changePercent}
                hint="vs previous 30 days"
                accent="#0071e3"
                icon="✉"
              />
              <StatCard
                label="Audience contacts"
                value={s?.contacts?.subscribed ?? 0}
                hint={`${formatNumber(s?.contacts?.total ?? 0)} total, ${formatNumber(
                  s?.contacts?.unsubscribed ?? 0,
                )} opted out`}
                accent="#34c759"
                icon="◉"
              />
              <StatCard
                label="Open rate"
                value={`${s?.rates?.open ?? 0}%`}
                hint={`${formatNumber(s?.engagement?.uniqueOpens ?? 0)} unique opens`}
                accent="#34c759"
                icon="◎"
              />
              <StatCard
                label="Campaigns executed"
                value={s?.campaigns?.total ?? 0}
                hint={
                  s?.campaigns?.active
                    ? `${s.campaigns.active} active now`
                    : `${formatNumber(s?.templates ?? 0)} templates configured`
                }
                accent={s?.campaigns?.active ? '#0071e3' : '#86868b'}
                icon="◆"
              />
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Delivery rate"
                value={`${s?.rates?.delivery ?? 0}%`}
                hint={`${formatNumber(s?.emails?.failed ?? 0)} failed deliveries`}
                accent="#34c759"
              />
              <StatCard
                label="Click-through rate"
                value={`${s?.rates?.click ?? 0}%`}
                hint={`${formatNumber(s?.engagement?.uniqueClicks ?? 0)} unique link clicks`}
                accent="#0071e3"
              />
              <StatCard
                label="Queued for dispatch"
                value={s?.emails?.queued ?? 0}
                hint={s?.emails?.queued ? 'Actively dispatching' : 'Queue idle'}
                accent="#0066cc"
              />
              <StatCard
                label="Unsubscribe rate"
                value={`${s?.rates?.unsubscribe ?? 0}%`}
                hint={`${formatNumber(s?.engagement?.unsubscribes ?? 0)} total opt-outs`}
                accent="#ff9500"
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
            <div className="flex items-center gap-1 rounded-full border border-control-gray bg-white p-1">
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
            { label: 'Delivery Rate', value: s?.rates?.delivery ?? 0, tone: '#0071e3' },
            { label: 'Open Rate', value: s?.rates?.open ?? 0, tone: '#34c759' },
            { label: 'Click-to-Open', value: s?.rates?.clickToOpen ?? 0, tone: '#ff9500' },
          ].map((gauge) => (
            <Card key={gauge.label} className="p-6">
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
          <Card>
            <div className="flex items-center justify-between gap-4 border-b border-control-gray pb-4">
              <div>
                <h3 className="font-display text-[18px] font-semibold text-ink">Recent Campaigns</h3>
                <p className="font-text text-[13px] text-slate">Last created sends</p>
              </div>
              <Link to="/campaigns" className="font-display text-[13px] font-medium text-apple-blue hover:underline">
                View all →
              </Link>
            </div>
            {recent.loading && !recent.data ? (
              <LoadingBlock rows={3} />
            ) : (
              <div className="pt-2">
                <Table
                  head={['Campaign', 'Status', 'Progress']}
                  empty={!recent.data?.campaigns?.length ? 'No campaigns executed yet.' : null}
                >
                  {(recent.data?.campaigns || []).map((campaign) => (
                    <tr key={campaign._id} className="hover:bg-studio-mist/60 transition-colors">
                      <td className="table-cell">
                        <Link
                          to={`/campaigns/${campaign._id}`}
                          className="font-display text-[14px] font-semibold text-ink hover:text-apple-blue transition-colors"
                        >
                          {campaign.name}
                        </Link>
                        <p className="font-text text-[12px] text-slate mt-0.5">
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
                        <p className="mt-1 font-text text-[11px] text-slate">
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

          <Card>
            <div className="flex items-center justify-between gap-4 border-b border-control-gray pb-4">
              <div>
                <h3 className="font-display text-[18px] font-semibold text-ink">Latest Activity</h3>
                <p className="font-text text-[13px] text-slate">Live transmission stream</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-studio-mist px-2.5 py-0.5 font-display text-[11px] font-medium text-slate border border-control-gray">
                <span className={`h-1.5 w-1.5 rounded-full ${hasActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate'}`} />
                {hasActive ? 'Live Streaming' : 'Queue Idle'}
              </span>
            </div>
            {recent.loading && !recent.data ? (
              <LoadingBlock rows={3} />
            ) : (
              <div className="pt-2">
                <Table
                  head={['Recipient', 'Status', 'Timestamp']}
                  empty={!recent.data?.activity?.length ? 'No transmission logs recorded yet.' : null}
                >
                  {(recent.data?.activity || []).map((log) => (
                    <tr key={log._id} className="hover:bg-studio-mist/60 transition-colors">
                      <td className="table-cell">
                        <span className="font-text text-[13.5px] font-medium text-ink">{log.email}</span>
                        <p className="truncate font-text text-[12px] text-slate mt-0.5 max-w-[200px]">
                          {log.campaign?.name || log.subject || '—'}
                        </p>
                      </td>
                      <td className="table-cell">
                        <Badge status={log.status} />
                        {log.error ? (
                          <p
                            className="mt-1 max-w-[180px] truncate font-text text-[11px] text-critical"
                            title={log.error}
                          >
                            {log.error}
                          </p>
                        ) : log.opens ? (
                          <p className="mt-1 font-text text-[11px] text-slate">
                            {log.opens} open{log.opens > 1 ? 's' : ''}
                            {log.clicks ? `, ${log.clicks} click${log.clicks > 1 ? 's' : ''}` : ''}
                          </p>
                        ) : null}
                      </td>
                      <td className="table-cell whitespace-nowrap font-text text-[12px] text-slate">
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
