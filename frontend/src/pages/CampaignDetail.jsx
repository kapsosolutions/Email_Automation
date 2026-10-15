import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Band, Hero } from '../components/Layout.jsx';
import { DeliveryDonut } from '../components/charts.jsx';
import { EmailPreview } from '../components/compose.jsx';
import {
  Badge,
  Card,
  ErrorNote,
  LoadingBlock,
  ProgressBar,
  SectionHeading,
  Table,
  useAsync,
  useInterval,
  useToast,
} from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { formatDateTime, formatNumber, formatRelative, toneFor } from '../lib/format.js';

const LOG_FILTERS = [
  { value: '', label: 'All Dispatches' },
  { value: 'sent', label: 'Delivered' },
  { value: 'failed', label: 'Failed' },
  { value: 'queued', label: 'In Queue' },
  { value: 'skipped', label: 'Suppressed' },
];

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [logStatus, setLogStatus] = useState('');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState('');

  const campaign = useAsync(() => api.campaigns.one(id), [id]);
  const logs = useAsync(
    () => api.campaigns.logs(id, { status: logStatus || undefined, page, limit: 25 }),
    [id, logStatus, page],
  );

  const data = campaign.data;
  const stats = data?.stats || {};
  const isRunning = data && ['sending', 'queued'].includes(data.status);

  useInterval(
    () => {
      campaign.refetch();
      logs.refetch();
    },
    4000,
    Boolean(isRunning),
  );

  const act = async (action, label) => {
    setBusy(action);
    try {
      await api.campaigns[action](id);
      toast.success(`Campaign ${label}.`);
      campaign.refetch();
      logs.refetch();
    } catch (error) {
      toast.error(error.message, `Could not ${label}`);
    } finally {
      setBusy('');
    }
  };

  const remove = async () => {
    // eslint-disable-next-line no-alert
    if (!window.confirm('Delete this campaign and all associated transmission records?')) return;
    try {
      await api.campaigns.remove(id);
      toast.success('Campaign removed.');
      navigate('/campaigns');
    } catch (error) {
      toast.error(error.message, 'Delete failed');
    }
  };

  const donut = [
    { key: 'sent', name: 'Delivered', value: stats.sent || 0 },
    { key: 'failed', name: 'Failed', value: stats.failed || 0 },
    { key: 'queued', name: 'In queue', value: stats.queued || 0 },
    { key: 'skipped', name: 'Suppressed', value: stats.skipped || 0 },
  ].filter((item) => item.value > 0);

  const donutTotal = donut.reduce((sum, item) => sum + item.value, 0);

  if (campaign.loading && !data) {
    return (
      <Band>
        <Card className="p-8">
          <LoadingBlock rows={4} />
        </Card>
      </Band>
    );
  }

  if (campaign.error) {
    return (
      <Band>
        <ErrorNote error={campaign.error} onRetry={campaign.refetch} />
        <Link to="/campaigns" className="btn-secondary mt-5">
          Back to campaigns
        </Link>
      </Band>
    );
  }

  return (
    <>
      <Hero
        eyebrow={`Campaign Telemetry · ${data.status}`}
        title={data.name}
        lead={data.subject}
        cta={
          <Link to="/send" className="btn-buy-cta font-medium">
            Start a new send
          </Link>
        }
        secondary={
          <Link to="/campaigns" className="btn-secondary font-medium">
            All campaigns
          </Link>
        }
        aside={
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-control-gray pb-3">
              <span className="font-display text-[12px] font-semibold uppercase tracking-wider text-slate">
                Dispatch Metadata
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-studio-mist px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate border border-control-gray">
                {data.status}
              </span>
            </div>
            <dl className="space-y-3">
              {[
                ['Dispatcher Driver', data.driver === 'bullmq' ? 'BullMQ Cluster' : 'Active Queue'],
                ['Paced Rate', `${data.ratePerMinute} messages / min`],
                ['Sender Address', data.fromEmail || '—'],
                ['Initiated', formatDateTime(data.startedAt || data.createdAt)],
                ...(data.completedAt ? [['Completed', formatDateTime(data.completedAt)]] : []),
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4">
                  <dt className="font-text text-[13px] text-slate">{label}</dt>
                  <dd className="truncate font-display text-[13px] font-medium text-ink">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        }
      />

      <Band tight>
        {/* --------------------------------------------------------- controls */}
        <div className="rounded-[28px] border border-control-gray bg-white p-7">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-control-gray pb-5">
            <div className="flex flex-wrap items-center gap-3">
              <Badge status={data.status} />
              <span className="font-display text-[14px] font-semibold text-ink">
                {formatNumber(stats.sent || 0)} of {formatNumber(stats.total || 0)} recipients delivered
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {['sending', 'queued'].includes(data.status) ? (
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  disabled={busy === 'pause'}
                  onClick={() => act('pause', 'paused')}
                >
                  ⏸ Pause
                </button>
              ) : null}
              {data.status === 'paused' ? (
                <button
                  type="button"
                  className="btn-buy-cta btn-sm"
                  disabled={busy === 'resume'}
                  onClick={() => act('resume', 'resumed')}
                >
                  ▶ Resume
                </button>
              ) : null}
              {['sending', 'queued', 'paused'].includes(data.status) ? (
                <button
                  type="button"
                  className="btn-ghost btn-sm text-critical hover:bg-critical/5"
                  disabled={busy === 'cancel'}
                  onClick={() => act('cancel', 'cancelled')}
                >
                  Cancel Send
                </button>
              ) : null}
              {stats.failed > 0 && !['sending', 'queued'].includes(data.status) ? (
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  disabled={busy === 'retryFailed'}
                  onClick={() => act('retryFailed', 'retrying failures')}
                >
                  Retry {formatNumber(stats.failed)} Failed
                </button>
              ) : null}
              {!['sending', 'queued'].includes(data.status) ? (
                <button
                  type="button"
                  className="btn-ghost btn-sm text-steel hover:text-critical"
                  onClick={remove}
                >
                  Delete Archive
                </button>
              ) : null}
            </div>
          </div>
          <div className="mt-5">
            <ProgressBar value={data.progress || 0} tone={toneFor(data.status).color} />
          </div>
          {data.error ? (
            <p className="mt-3 font-text text-[13px] text-critical">{data.error}</p>
          ) : null}
        </div>

        {/* ------------------------------------------------------------ stats */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="grid gap-5 sm:grid-cols-2">
            {[
              { label: 'Recipients', value: stats.total || 0, tone: '#1d1d1f' },
              { label: 'Delivered', value: stats.sent || 0, tone: '#34c759' },
              { label: 'Failed Deliveries', value: stats.failed || 0, tone: '#ff3b30' },
              { label: 'Suppressed / Skipped', value: stats.skipped || 0, tone: '#86868b' },
              { label: 'Unique Opens', value: stats.opened || 0, tone: '#0071e3' },
              { label: 'Unique Link Clicks', value: stats.clicked || 0, tone: '#0066cc' },
              { label: 'Unsubscribe Requests', value: stats.unsubscribed || 0, tone: '#ff9500' },
              { label: 'Queued in Dispatcher', value: stats.queued || 0, tone: '#0071e3' },
            ].map((cell) => (
              <div
                key={cell.label}
                className="rounded-[28px] border border-control-gray bg-white p-6"
              >
                <p className="font-display text-[12px] font-semibold uppercase tracking-wider text-slate">
                  {cell.label}
                </p>
                <p
                  className="mt-3 font-display text-[32px] font-semibold leading-none tracking-tight"
                  style={{ color: cell.tone }}
                >
                  {formatNumber(cell.value)}
                </p>
                {cell.label === 'Delivered' && stats.total ? (
                  <p className="mt-2 font-text text-[12px] text-slate">
                    {Math.round(((stats.sent || 0) / stats.total) * 100)}% of recipient list
                  </p>
                ) : null}
                {cell.label === 'Unique Opens' && stats.sent ? (
                  <p className="mt-2 font-text text-[12px] text-slate">
                    {Math.round(((stats.opened || 0) / stats.sent) * 100)}% verified open rate
                  </p>
                ) : null}
              </div>
            ))}
          </div>

          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="font-display text-[17px] font-semibold text-ink">Outcome Distribution</h3>
              <p className="mt-0.5 font-text text-[13px] text-slate">Recipient status breakdown</p>
              <div className="mt-4 h-[240px]">
                {donutTotal ? (
                  <DeliveryDonut data={donut} total={donutTotal} />
                ) : (
                  <p className="flex h-full items-center justify-center font-text text-[13px] text-slate">
                    No delivery events recorded yet.
                  </p>
                )}
              </div>
            </Card>

            {data.placeholders?.length ? (
              <Card className="p-6">
                <h3 className="font-display text-[17px] font-semibold text-ink">Interpolated Tokens</h3>
                <p className="mt-0.5 font-text text-[13px] text-slate">Resolved column placeholders</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {data.placeholders.map((key) => (
                    <span key={key} className="chip !text-[12px] !py-0.5">{`{${key}}`}</span>
                  ))}
                </div>
                {Object.keys(data.defaults || {}).length ? (
                  <p className="mt-3 font-text text-[12px] text-slate">
                    Fallbacks: {Object.entries(data.defaults).map(([k, v]) => `${k}="${v}"`).join(', ')}
                  </p>
                ) : null}
              </Card>
            ) : null}

            <EmailPreview
              html={data.html}
              subject={data.subject}
              from={{ name: data.fromName, email: data.fromEmail }}
              height={320}
            />
          </div>
        </div>
      </Band>

      {/* ------------------------------------------------------------- logs */}
      <Band tight>
        <SectionHeading
          sub="Live per-recipient transmission and engagement telemetry."
          action={
            <div className="flex flex-wrap gap-1 rounded-full border border-control-gray bg-white p-1">
              {LOG_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  className={
                    logStatus === filter.value
                      ? 'btn-pill-tab-active !py-1 !px-3 !text-[12px]'
                      : 'btn-pill-tab !bg-transparent !py-1 !px-3 !text-[12px]'
                  }
                  onClick={() => {
                    setLogStatus(filter.value);
                    setPage(1);
                  }}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          }
        >
          Delivery Audit Log
        </SectionHeading>

        <div className="rounded-[28px] border border-control-gray bg-white p-7">
          {logs.loading && !logs.data ? (
            <LoadingBlock rows={4} />
          ) : (
            <>
              <Table
                head={['Recipient Email', 'Delivery Status', 'Engagement Metrics', 'Timestamp', 'Message-ID / Diagnostics']}
                empty={!logs.data?.logs?.length ? 'No transmission log records match the filter.' : null}
              >
                {(logs.data?.logs || []).map((log) => (
                  <tr key={log._id} className="hover:bg-studio-mist/60 transition-colors">
                    <td className="table-cell whitespace-nowrap font-medium text-ink">{log.email}</td>
                    <td className="table-cell">
                      <Badge status={log.status} />
                    </td>
                    <td className="table-cell whitespace-nowrap text-slate font-text text-[13px]">
                      {log.opens || log.clicks ? (
                        <span>
                          <span className="font-semibold text-ink">{log.opens || 0}</span> open{log.opens === 1 ? '' : 's'},{' '}
                          <span className="font-semibold text-ink">{log.clicks || 0}</span> click{log.clicks === 1 ? '' : 's'}
                        </span>
                      ) : (
                        <span className="text-steel">—</span>
                      )}
                      {log.unsubscribedAt ? (
                        <span className="ml-2 inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                          Unsubscribed
                        </span>
                      ) : ''}
                    </td>
                    <td className="table-cell whitespace-nowrap text-steel font-text text-[12px]">
                      {log.sentAt ? formatRelative(log.sentAt) : '—'}
                    </td>
                    <td className="table-cell max-w-[280px]">
                      {log.error ? (
                        <span className="block truncate text-critical font-medium text-[12px]" title={log.error}>
                          {log.error}
                        </span>
                      ) : (
                        <span className="block truncate font-mono text-[11px] text-steel" title={log.messageId}>
                          {log.messageId || '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </Table>

              {(logs.data?.pages || 1) > 1 ? (
                <div className="flex items-center justify-between gap-4 border-t border-control-gray pt-4 mt-4">
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    disabled={page <= 1}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                  >
                    ← Previous
                  </button>
                  <span className="font-text text-[13px] text-slate">
                    Page {logs.data.page} of {logs.data.pages} · {formatNumber(logs.data.total)} records
                  </span>
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    disabled={page >= logs.data.pages}
                    onClick={() => setPage((value) => value + 1)}
                  >
                    Next →
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </Band>
    </>
  );
}
