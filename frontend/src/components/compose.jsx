import { useCallback, useEffect, useRef, useState } from 'react';
import { Card } from './ui.jsx';
import { formatBytes } from '../lib/format.js';

/* ------------------------------------------------------------- file picker */

const ACCEPT = '.csv,.xls,.xlsx,.tsv,.txt';

/**
 * Apple-style Drop target for spreadsheets.
 * 28px rounding, flat surface hover, hairline border.
 */
export function FileDrop({ file, onFile, disabled, progress }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files) => {
    const picked = files?.[0];
    if (picked) onFile(picked);
  };

  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
        className={`flex w-full flex-col items-center justify-center rounded-[28px] border-2 border-dashed px-8 py-12 text-center transition-colors duration-150 ${
          dragging
            ? 'border-pricing-blue bg-pricing-blue/5'
            : 'border-control-gray bg-white hover:border-steel hover:bg-studio-mist/40'
        } disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-studio-mist text-pricing-blue border border-control-gray transition-transform duration-200 group-hover:scale-105">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
            <path
              d="M12 16V4m0 0L8 8m4-4 4 4"
              stroke="#00c269"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"
              stroke="#86868b"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <span className="font-display text-[18px] font-semibold tracking-tight text-ink">
          {file ? file.name : 'Upload recipient spreadsheet'}
        </span>
        <span className="mt-1.5 max-w-md font-text text-[13.5px] font-normal leading-relaxed text-slate">
          {file
            ? `${formatBytes(file.size)} · Click or drop to replace`
            : 'Drop CSV, XLS, or XLSX up to 15 MB. Every column header converts automatically into an in-message token.'}
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(event) => handleFiles(event.target.files)}
      />

      {typeof progress === 'number' && progress > 0 && progress < 100 ? (
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-control-gray">
          <div className="h-full bg-pricing-blue transition-all duration-200 rounded-full" style={{ width: `${progress}%` }} />
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------- placeholder map */

const STATUS_STYLE = {
  matched: { label: 'matched column', color: '#34c759' },
  default: { label: 'default fallback', color: '#0071e3' },
  system: { label: 'system variable', color: '#86868b' },
  unmatched: { label: 'unresolved column', color: '#ff3b30' },
};

/**
 * Shows every {placeholder} in the draft against the spreadsheet column.
 */
export function PlaceholderMap({ mapping = [], columns = [], onInsert, defaults = {}, onDefault }) {
  if (!mapping.length) {
    return (
      <p className="font-text text-[13px] text-slate">
        No <code className="font-mono text-ink text-[12px]">{'{tokens}'}</code> detected in subject line or body yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {mapping.map((item) => {
        const style = STATUS_STYLE[item.status] || STATUS_STYLE.unmatched;
        const fallbackValue = defaults[item.placeholder] ?? item.defaultValue ?? '';
        return (
          <div
            key={item.placeholder}
            className="flex flex-col gap-2 rounded-[20px] border border-control-gray bg-white p-3.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-[13px] font-semibold text-ink">
                {`{${item.placeholder}}`}
              </span>
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{ backgroundColor: `${style.color}15`, color: style.color }}
              >
                ● {style.label}
              </span>
            </div>

            {item.status === 'matched' ? (
              <span className="font-text text-[12.5px] text-slate">
                Maps to <strong className="text-ink font-semibold">“{item.matchedColumn}”</strong>
              </span>
            ) : item.status === 'system' ? (
              <span className="font-text text-[12.5px] text-slate">Built-in variable</span>
            ) : onDefault ? (
              <input
                className="field !h-8 !py-1 !px-3 sm:w-48 !text-[12.5px]"
                placeholder="Fallback value…"
                value={fallbackValue}
                onChange={(event) => onDefault(item.placeholder, event.target.value)}
              />
            ) : null}
          </div>
        );
      })}

      {columns.length && onInsert ? (
        <div className="pt-2">
          <p className="mb-2 font-display text-[12px] font-semibold uppercase tracking-wider text-slate">
            Quick Insert Available Column
          </p>
          <div className="flex flex-wrap gap-1.5">
            {columns.map((column) => (
              <button
                key={column}
                type="button"
                className="chip hover:border-slate hover:text-ink transition-colors"
                onClick={() => onInsert(column)}
              >
                + {`{${column}}`}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------- spam / lint score */

const GRADE_TONE = {
  excellent: '#34c759',
  good: '#0071e3',
  risky: '#ff9500',
  poor: '#ff3b30',
};

const LEVEL_TONE = { error: '#ff3b30', warning: '#ff9500', info: '#86868b' };

export function DeliverabilityScore({ analysis, loading }) {
  if (loading && !analysis) {
    return <p className="font-text text-[13.5px] text-slate">Analyzing deliverability metrics…</p>;
  }
  if (!analysis) return null;

  const tone = GRADE_TONE[analysis.grade] || '#86868b';

  return (
    <div className="rounded-[24px] border border-control-gray bg-white p-5">
      <div className="flex items-center gap-5">
        <div className="relative h-16 w-16 shrink-0">
          <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="#f5f5f7" strokeWidth="3.5" />
            <circle
              cx="18" cy="18" r="15.5" fill="none"
              stroke={tone} strokeWidth="3.5" strokeLinecap="round"
              strokeDasharray={`${(analysis.score / 100) * 97.4} 97.4`}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center font-display text-[18px] font-semibold text-ink">
            {analysis.score}
          </span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 font-display text-[11px] font-semibold uppercase tracking-wider text-white"
              style={{ backgroundColor: tone }}
            >
              {analysis.grade}
            </span>
            <span className="font-display text-[13.5px] font-semibold text-ink">Deliverability Score</span>
          </div>
          <p className="mt-1 font-text text-[12.5px] text-slate">
            {analysis.stats.textLength} chars · {analysis.stats.linkCount} links · {analysis.stats.imageCount} images
          </p>
        </div>
      </div>

      {analysis.issues.length ? (
        <ul className="mt-4 space-y-2 border-t border-control-gray pt-4">
          {analysis.issues.map((issue) => (
            <li key={issue.title} className="flex items-start gap-2.5">
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: LEVEL_TONE[issue.level] }}
              />
              <div>
                <span className="font-display text-[12.5px] font-semibold text-ink">{issue.title}</span>
                <span className="block font-text text-[12px] leading-relaxed text-slate">
                  {issue.detail}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 flex items-center gap-1.5 font-text text-[12.5px] text-[#00a859] font-medium">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          No spam triggers or formatting risks detected.
        </p>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- preview */

const EMPTY_PREVIEW =
  '<div style="font-family:-apple-system,sans-serif;color:#707070;padding:32px;text-align:center;"><p>Live email preview will appear here.</p></div>';

// Email HTML is authored at a fixed pixel width, so the frame is rendered at
// that width and scaled down to fit the column. Scaling the whole document
// keeps proportions intact; sizing the frame to the column instead would crop
// the layout and leave a horizontal scrollbar.
const DEVICE_WIDTHS = { desktop: 680, mobile: 390 };

/**
 * Sandboxed preview of the composed email, scaled to fit its container.
 *
 * `allow-same-origin` is required so the parent can read the rendered document
 * height and size the frame to its full content. Scripts stay blocked because
 * `allow-scripts` is deliberately absent, so untrusted email HTML still cannot
 * execute anything.
 */
export function EmailPreview({
  html,
  subject,
  from,
  to,
  // `height` is the fallback document height before the frame reports its own.
  height = 500,
  // `viewport` caps the visible panel. Accepts any CSS length, so callers can
  // pass a viewport-relative value to keep a sticky panel on screen.
  viewport,
  device: initialDevice = 'desktop',
}) {
  const [device, setDevice] = useState(initialDevice);
  const [fit, setFit] = useState(true);
  const [available, setAvailable] = useState(0);
  const [docHeight, setDocHeight] = useState(height);

  const shellRef = useRef(null);
  const frameRef = useRef(null);

  const baseWidth = DEVICE_WIDTHS[device];
  const scale = fit && available ? Math.min(1, available / baseWidth) : 1;

  // Track the column width so the scale factor follows window resizes.
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return undefined;

    const measureShell = () => setAvailable(shell.clientWidth);
    measureShell();

    const observer = new ResizeObserver(measureShell);
    observer.observe(shell);
    return () => observer.disconnect();
  }, []);

  // Read the real document height so the whole email is shown, not a window of it.
  const measureDocument = useCallback(() => {
    try {
      const doc = frameRef.current?.contentDocument;
      if (!doc) return;
      const measured = Math.max(
        doc.documentElement?.scrollHeight || 0,
        doc.body?.scrollHeight || 0,
      );
      if (measured > 0) setDocHeight(measured);
    } catch {
      // Blocked by the sandbox: fall back to the caller's height.
    }
  }, []);

  useEffect(() => {
    // Images and webfonts settle after load, so re-measure a moment later.
    const timers = [setTimeout(measureDocument, 80), setTimeout(measureDocument, 500)];
    return () => timers.forEach(clearTimeout);
  }, [html, device, measureDocument]);

  const openStandalone = () => {
    if (!html) return;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const scaledHeight = Math.max(1, Math.round(docHeight * scale));

  return (
    <div className="overflow-hidden rounded-[28px] border border-control-gray bg-white">
      <div className="border-b border-control-gray bg-studio-mist/70 px-5 py-3.5">
        <div className="mb-2.5 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full border border-[#e0443e]/80 bg-[#ff5f56] shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]" />
            <span className="h-3 w-3 rounded-full border border-[#dea123]/80 bg-[#ffbd2e] shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]" />
            <span className="h-3 w-3 rounded-full border border-[#1aab29]/80 bg-[#27c93f] shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]" />
          </div>
          <span className="font-display text-[11px] font-semibold uppercase tracking-wider text-steel">
            Email Client Preview
          </span>

          <div className="ml-auto flex items-center gap-1.5">
            {Object.keys(DEVICE_WIDTHS).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={device === option}
                onClick={() => setDevice(option)}
                className={`rounded-full px-2.5 py-1 font-display text-[11px] font-semibold capitalize transition-colors ${
                  device === option
                    ? 'bg-ink text-white'
                    : 'border border-control-gray bg-white text-slate hover:text-ink'
                }`}
              >
                {option}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={!fit}
              onClick={() => setFit((value) => !value)}
              title={fit ? 'Switch to actual size' : 'Scale to fit the panel'}
              className="rounded-full border border-control-gray bg-white px-2.5 py-1 font-display text-[11px] font-semibold text-slate transition-colors hover:text-ink"
            >
              {fit ? `Fit ${Math.round(scale * 100)}%` : '100%'}
            </button>
            <button
              type="button"
              onClick={openStandalone}
              disabled={!html}
              title="Open this rendering in a new tab"
              className="rounded-full border border-control-gray bg-white px-2.5 py-1 font-display text-[11px] font-semibold text-slate transition-colors hover:text-ink disabled:opacity-40"
            >
              Open ↗
            </button>
          </div>
        </div>

        <p className="font-display text-[15px] font-semibold text-ink">
          {subject || 'No subject line specified'}
        </p>
        <p className="mt-0.5 font-text text-[12.5px] text-slate">
          From: {from?.name ? `${from.name} <${from.email || '—'}>` : from?.email || '—'}
          {to ? ` · To: ${to}` : ''}
        </p>
      </div>

      {/* Vertical overflow scrolls here; horizontal overflow is eliminated by
          the scale factor rather than hidden behind a scrollbar. */}
      <div
        ref={shellRef}
        className="overflow-y-auto overflow-x-auto bg-studio-mist/40 p-4"
        style={{ maxHeight: viewport ?? height }}
      >
        <div
          className="relative mx-auto overflow-hidden rounded-[14px] border border-control-gray bg-white"
          style={{ width: Math.round(baseWidth * scale), height: scaledHeight }}
        >
          <iframe
            ref={frameRef}
            title="Email preview"
            srcDoc={html || EMPTY_PREVIEW}
            sandbox="allow-same-origin"
            scrolling="no"
            onLoad={measureDocument}
            className="absolute left-0 top-0 border-0 bg-white"
            style={{
              width: baseWidth,
              height: docHeight,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- step rail */

export function StepRail({ steps, current, onSelect }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 sm:gap-3">
      {steps.map((step, index) => {
        const state = index === current ? 'current' : index < current ? 'done' : 'todo';
        return (
          <li key={step.id}>
            <button
              type="button"
              disabled={state === 'todo' && !step.reachable}
              onClick={() => onSelect?.(index)}
              className={`group flex items-center gap-2.5 rounded-full px-3.5 py-1.5 font-display transition-colors disabled:cursor-not-allowed ${
                state === 'current'
                  ? 'bg-ink text-white'
                  : state === 'done'
                    ? 'bg-pricing-blue/10 text-pricing-blue hover:bg-pricing-blue/15'
                    : 'bg-white text-slate border border-control-gray hover:text-ink'
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                  state === 'current'
                    ? 'bg-white text-ink'
                    : state === 'done'
                      ? 'bg-pricing-blue text-white'
                      : 'bg-studio-mist text-slate'
                }`}
              >
                {state === 'done' ? (
                  <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  index + 1
                )}
              </span>
              <span className="text-[12.5px] font-medium">{step.label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
