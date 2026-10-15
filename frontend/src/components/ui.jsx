import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { formatNumber, toneFor } from '../lib/format.js';

/* ---------------------------------------------------------------- surfaces */

export function Card({ as: Tag = 'div', className = '', hoverable = false, children, ...rest }) {
  return (
    <Tag
      className={`rounded-[28px] border border-control-gray bg-white p-7 transition-colors duration-150 ${
        hoverable ? 'hover:border-hairline-silver' : ''
      } ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function SectionHeading({ children, sub, action, centered = false }) {
  return (
    <div
      className={`mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${
        centered ? 'sm:flex-col sm:items-center sm:text-center' : ''
      }`}
    >
      <div className={centered ? 'max-w-reading' : ''}>
        <h2 className="font-display text-[26px] sm:text-[32px] font-semibold leading-tight tracking-tight text-ink text-balance">
          {children}
        </h2>
        {sub ? (
          <p className="mt-1.5 font-text text-[15px] font-normal leading-relaxed text-slate">
            {sub}
          </p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2.5">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ badges */

export function Badge({ status, children, tone }) {
  const resolved = tone ? { color: tone, label: children } : toneFor(status);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-display text-[11.5px] font-medium"
      style={{
        color: resolved.color,
        backgroundColor: `${resolved.color}14`,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: resolved.color }}
      />
      {children || resolved.label}
    </span>
  );
}

/* ---------------------------------------------------------------- stat card */

export function StatCard({ label, value, delta, hint, accent = '#0071e3', icon }) {
  const positive = typeof delta === 'number' && delta >= 0;
  return (
    <div className="rounded-[28px] border border-control-gray bg-white p-6 transition-colors duration-150 hover:border-hairline-silver">
      <div className="flex items-center justify-between gap-4">
        <p className="font-display text-[12px] font-semibold uppercase tracking-wider text-slate">
          {label}
        </p>
        {icon ? (
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold"
            style={{ backgroundColor: `${accent}14`, color: accent }}
          >
            {icon}
          </span>
        ) : null}
      </div>

      <p className="mt-3 font-display text-[32px] sm:text-[36px] font-semibold leading-none tracking-tight text-ink">
        {typeof value === 'number' ? formatNumber(value) : value}
      </p>

      <div className="mt-3 flex items-center gap-2">
        {typeof delta === 'number' ? (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-display text-[11px] font-semibold"
            style={{
              color: positive ? '#34c759' : '#ff3b30',
              backgroundColor: positive ? '#34c75918' : '#ff3b3018',
            }}
          >
            {positive ? '↑' : '↓'} {Math.abs(delta)}%
          </span>
        ) : null}
        {hint ? <span className="font-text text-[12px] text-steel truncate">{hint}</span> : null}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- progress */

export function ProgressBar({ value = 0, tone = '#0071e3', showLabel = true }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-studio-mist border border-control-gray"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${clamped}%`, backgroundColor: tone }}
        />
      </div>
      {showLabel ? (
        <span className="w-10 shrink-0 text-right font-display text-[12px] font-semibold text-slate">
          {clamped}%
        </span>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------- 3D Cube Spinner */

/**
 * 3D Cube Wireframe Spinner (User-specified geometry).
 */
export function CubeSpinner({ size = 44, className = '' }) {
  const scale = size / 44;
  return (
    <div
      className={`spinner-container ${className}`}
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        flexShrink: 0,
      }}
      role="status"
      aria-label="Loading"
    >
      <div
        style={{
          width: 44,
          height: 44,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          transformStyle: 'preserve-3d',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <div className="spinner">
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
        </div>
      </div>
    </div>
  );
}

/**
 * Primary Spinner adapter: renders the 3D rotating cube.
 */
export function Spinner({ size = 28, className = '' }) {
  return <CubeSpinner size={size} className={className} />;
}

export function LoadingBlock({ label = 'Loading', rows = 3 }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 px-6" aria-live="polite" aria-busy="true">
      <CubeSpinner size={44} />
      <span className="font-text text-[13px] text-slate">{label}</span>
    </div>
  );
}

export function EmptyState({ title, body, action, icon = '✦' }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-studio-mist font-display text-[20px] text-slate border border-control-gray">
        {icon}
      </span>
      <h3 className="font-display text-[20px] font-semibold text-ink">{title}</h3>
      {body ? <p className="mt-1.5 max-w-reading font-text text-[14px] text-slate leading-relaxed">{body}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function ErrorNote({ error, onRetry }) {
  if (!error) return null;
  const details = Array.isArray(error.details) ? error.details : null;
  return (
    <div className="rounded-[20px] border border-critical/30 bg-white p-5 text-ink">
      <div className="flex items-center gap-3">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-critical text-white font-bold text-[11px]">
          !
        </span>
        <p className="font-display text-[13.5px] font-semibold text-critical">{error.message || String(error)}</p>
      </div>
      {details ? (
        <ul className="mt-3 list-inside list-disc font-text text-[13px] text-slate">
          {details.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      {onRetry ? (
        <button type="button" className="btn-secondary btn-sm mt-3" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------- forms */

export function Field({ label, hint, error, children, required, htmlFor }) {
  return (
    <div className="space-y-1.5">
      <label className="field-label" htmlFor={htmlFor}>
        {label}
        {required ? <span className="ml-1 text-pricing-blue">*</span> : null}
      </label>
      {children}
      {hint && !error ? (
        <p className="font-text text-[12px] text-slate">{hint}</p>
      ) : null}
      {error ? <p className="font-text text-[12px] font-medium text-critical">{error}</p> : null}
    </div>
  );
}

export function Select({ className = '', children, ...rest }) {
  return (
    <select className={`field cursor-pointer bg-white ${className}`} {...rest}>
      {children}
    </select>
  );
}

/* ------------------------------------------------------------------- tables */

export function Table({ head, children, empty }) {
  return (
    <div className="overflow-x-auto rounded-[20px]">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-studio-mist/70">
            {head.map((cell) => (
              <th key={typeof cell === 'string' ? cell : cell.key} className="table-head">
                {typeof cell === 'string' ? cell : cell.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-control-gray">
          {children}
          {empty ? (
            <tr>
              <td colSpan={head.length} className="px-6 py-12 text-center font-text text-[14px] text-slate">
                {empty}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------- toasts */

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((toast) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((current) => [...current, { id, tone: 'info', ...toast }]);
    setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), toast.duration || 5000);
  }, []);

  const value = useMemo(
    () => ({
      push,
      success: (message, title) => push({ tone: 'success', message, title }),
      error: (message, title) => push({ tone: 'error', message, title, duration: 8000 }),
      info: (message, title) => push({ tone: 'info', message, title }),
    }),
    [push],
  );

  const tones = {
    success: '#34c759',
    error: '#ff3b30',
    info: '#0071e3',
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex w-[min(380px,calc(100vw-36px))] flex-col gap-2.5">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto rounded-[20px] border border-control-gray bg-white p-4"
            role="status"
          >
            <div className="flex items-start gap-3">
              <span
                className="mt-1 h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: tones[toast.tone] }}
              />
              <div className="min-w-0">
                {toast.title ? (
                  <p className="font-display text-[13.5px] font-semibold text-ink">{toast.title}</p>
                ) : null}
                <p className="font-text text-[12.5px] leading-relaxed text-slate">{toast.message}</p>
              </div>
              <button
                type="button"
                aria-label="Dismiss"
                className="ml-auto shrink-0 rounded-full p-1 text-steel hover:text-ink transition-colors"
                onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/* -------------------------------------------------------------------- hooks */

export function useAsync(loader, deps = [], { immediate = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loader();
      setData(result);
      return result;
    } catch (caught) {
      setError(caught);
      return null;
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (immediate) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, immediate]);

  return { data, loading, error, refetch: run, setData };
}

export function useInterval(callback, delay, active = true) {
  useEffect(() => {
    if (!active || !delay) return undefined;
    const id = setInterval(callback, delay);
    return () => clearInterval(id);
  }, [callback, delay, active]);
}
