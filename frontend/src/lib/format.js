export const formatNumber = (value) =>
  new Intl.NumberFormat('en-US').format(Number.isFinite(value) ? value : 0);

export const formatPercent = (value) => `${Number.isFinite(value) ? value : 0}%`;

export const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

export const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export const formatDateTime = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatRelative = (value) => {
  if (!value) return '—';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
};

/**
 * Apple Chart & Status Palette.
 * Pricing Blue (#0071e3), Apple Blue (#0066cc), Apple Green (#34c759),
 * Apple Orange (#ff9500), Apple Red (#ff3b30), Slate (#707070), and Steel (#86868b).
 */
export const CHART_COLORS = {
  blue: '#0071e3',
  blueDeep: '#0066cc',
  blueLight: '#409cff',
  fbBlue: '#0071e3',
  purple: '#af52de',
  green: '#34c759',
  yellow: '#ff9500',
  red: '#ff3b30',
  grey: '#e6e6e8',
  greyDark: '#707070',
  charcoal: '#333336',
  inkDeep: '#1d1d1f',
};

export const STATUS_TONE = {
  sent: { label: 'Delivered', color: '#34c759' },
  completed: { label: 'Completed', color: '#34c759' },
  sending: { label: 'Sending', color: '#0071e3' },
  queued: { label: 'Queued', color: '#0066cc' },
  paused: { label: 'Paused', color: '#ff9500' },
  failed: { label: 'Failed', color: '#ff3b30' },
  bounced: { label: 'Bounced', color: '#ff3b30' },
  cancelled: { label: 'Cancelled', color: '#707070' },
  skipped: { label: 'Suppressed', color: '#86868b' },
  draft: { label: 'Draft', color: '#707070' },
  subscribed: { label: 'Subscribed', color: '#0071e3' },
  unsubscribed: { label: 'Unsubscribed', color: '#ff9500' },
};

export const toneFor = (status) =>
  STATUS_TONE[status] || { label: status || 'unknown', color: '#707070' };
