/**
 * Apple-inspired minimalist Brand Mark & Lockup.
 * Features an editorial monochrome glyph with SF Pro typography.
 */
export function AppleMark({ size = 36, className = '' }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-[10px] bg-ink text-white ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        width={Math.round(size * 0.55)}
        height={Math.round(size * 0.55)}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M3 7.5C3 6.11929 4.11929 5 5.5 5H18.5C19.8807 5 21 6.11929 21 7.5V16.5C21 17.8807 19.8807 19 18.5 19H5.5C4.11929 19 3 17.8807 3 16.5V7.5Z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M3.5 7L12 12.5L20.5 7"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/** Nav brand lockup: Apple-style glyph + SF Pro text */
export function BrandLockup() {
  return (
    <div className="flex items-center gap-3">
      <AppleMark size={32} />
      <div className="flex flex-col">
        <span className="font-display text-[15px] font-semibold leading-tight tracking-tight text-ink">
          Mail Automation
        </span>
        <span className="font-text text-[11px] font-normal leading-tight text-slate">
          Production Console
        </span>
      </div>
    </div>
  );
}

// Backward-compatibility exports
export const MetaMark = AppleMark;
export const GoogleMark = AppleMark;
export default AppleMark;
