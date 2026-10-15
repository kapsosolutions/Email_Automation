import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Band, Hero } from '../components/Layout.jsx';
import {
  Badge,
  Card,
  EmptyState,
  ErrorNote,
  LoadingBlock,
  ProgressBar,
  SectionHeading,
  Table,
  useAsync,
  useInterval,
} from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { formatDateTime, formatNumber, toneFor } from '../lib/format.js';

const FILTERS = [
  { value: '', label: 'All Campaigns' },
  { value: 'sending', label: 'Sending' },
  { value: 'completed', label: 'Completed' },
  { value: 'paused', label: 'Paused' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function Campaigns() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const campaigns = useAsync(
    () => api.campaigns.all({ status: status || undefined, page, limit: 20 }),
    [status, page],
  );

  const hasLive = (campaigns.data?.campaigns || []).some((campaign) =>
    ['sending', 'queued'].includes(campaign.status),
  );
  useInterval(campaigns.refetch, 6000, hasLive);

  return (
    <>
      <Hero
        eyebrow="Campaign Telemetry"
        title="Campaigns"
        lead="Inspect delivery rates, engagement metrics, and transmission history across all dispatched campaigns."
        cta={
          <Link to="/send" className="btn-buy-cta font-medium">
            Start a send
          </Link>
        }
        secondary={
          <Link to="/templates" className="btn-secondary font-medium">
            Manage templates
          </Link>
        }
      />

      <Band tight>
        <SectionHeading
          sub="Chronological dispatch log. Select any campaign to inspect delivery states."
          action={
            <div className="flex flex-wrap gap-1 rounded-full border border-control-gray bg-white p-1">
              {FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  className={
                    status === filter.value
                      ? 'btn-pill-tab-active !py-1 !px-3 !text-[12px]'
                      : 'btn-pill-tab !bg-transparent !py-1 !px-3 !text-[12px]'
                  }
                  onClick={() => {
                    setStatus(filter.value);
                    setPage(1);
                  }}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          }
        >
          Campaign Telemetry
        </SectionHeading>

        <ErrorNote error={campaigns.error} onRetry={campaigns.refetch} />

        <div className="rounded-[28px] border border-control-gray bg-white p-7">
          {campaigns.loading && !campaigns.data ? (
            <LoadingBlock rows={4} />
          ) : !campaigns.data?.campaigns?.length ? (
            <EmptyState
              title="No campaign telemetry recorded"
              body={
                status
                  ? 'No campaigns match the specified filter query.'
                  : 'Upload an audience list and dispatch your first campaign to populate telemetry.'
              }
              action={
                <Link to="/send" className="btn-buy-cta">
                  Start a send
                </Link>
              }
              icon="◆"
            />
          ) : (
            <>
              <Table head={['Campaign Name & Subject', 'Audience', 'Status', 'Progress', 'Transmission Counts', 'Dispatched']}>
                {campaigns.data.campaigns.map((campaign) => (
                  <tr key={campaign._id} className="hover:bg-studio-mist/60 transition-colors">
                    <td className="table-cell">
                      <Link
                        to={`/campaigns/${campaign._id}`}
                        className="font-display text-[14px] font-semibold text-ink hover:text-apple-blue transition-colors"
                      >
                        {campaign.name}
                      </Link>
                      <p className="max-w-[280px] truncate font-text text-[12px] text-slate mt-0.5">
                        {campaign.subject}
                      </p>
                    </td>
                    <td className="table-cell whitespace-nowrap text-slate font-text text-[13px]">
                      {campaign.list?.name || '—'}
                    </td>
                    <td className="table-cell">
                      <Badge status={campaign.status} />
                    </td>
                    <td className="table-cell w-40">
                      <ProgressBar value={campaign.progress} tone={toneFor(campaign.status).color} />
                    </td>
                    <td className="table-cell whitespace-nowrap text-slate font-text text-[13px]">
                      <span className="font-semibold text-ink">{formatNumber(campaign.stats?.sent || 0)}</span> sent
                      {campaign.stats?.failed ? (
                        <span className="text-critical font-medium"> · {formatNumber(campaign.stats.failed)} failed</span>
                      ) : ''}
                    </td>
                    <td className="table-cell whitespace-nowrap text-steel font-text text-[12px]">
                      {formatDateTime(campaign.startedAt || campaign.createdAt)}
                    </td>
                  </tr>
                ))}
              </Table>

              {(campaigns.data.pages || 1) > 1 ? (
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
                    Page {campaigns.data.page} of {campaigns.data.pages}
                  </span>
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    disabled={page >= campaigns.data.pages}
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
