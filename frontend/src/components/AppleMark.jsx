/**
 * WATI-inspired Brand Mark & Lockup.
 * Features signature emerald green glyph (#00C269) with modern typography.
 */
export function AppleMark({ size = 36, className = '' }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-[10px] bg-gradient-to-br from-[#00C269] to-[#00A859] text-white shadow-sm ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        width={Math.round(size * 0.6)}
        height={Math.round(size * 0.6)}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M3 6.5C3 5.39543 3.89543 4.5 5 4.5H19C20.1046 4.5 21 5.39543 21 6.5V17.5C21 18.6046 20.1046 19.5 19 19.5H5C3.89543 19.5 3 18.6046 3 17.5V6.5Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M3 7L12 13L21 7"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="17.5" cy="15.5" r="2" fill="white" />
      </svg>
    </span>
  );
}

/** Nav brand lockup: WATI style glyph + clean text */
export function BrandLockup() {
  return (
    <div className="flex items-center gap-2.5">
      <AppleMark size={34} />
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5">
          <span className="font-display text-[16px] font-bold leading-tight tracking-tight text-slate-900">
            WATI
          </span>
          <span className="inline-flex items-center rounded bg-[#e8f8f0] px-1.5 py-0.5 text-[10px] font-semibold text-[#00a859]">
            Mail
          </span>
        </div>
        <span className="font-text text-[11px] font-medium leading-tight text-slate-400">
          Campaign Automation
        </span>
      </div>
    </div>
  );
}

// Backward-compatibility exports
export const MetaMark = AppleMark;
export const GoogleMark = AppleMark;
export default AppleMark;
