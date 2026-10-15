import { NavLink, Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { BrandLockup } from './AppleMark.jsx';

const NAV = [
  {
    to: '/',
    label: 'Dashboard',
    end: true,
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
      </svg>
    ),
  },
  {
    to: '/send',
    label: 'Send Flow',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
      </svg>
    ),
  },
  {
    to: '/templates',
    label: 'Create a Mail',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    to: '/campaigns',
    label: 'Campaigns',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
];

/**
 * Apple-style Sidebar navigation dock.
 * Minimalist, elegant, fixed on desktop with clean hairline separation.
 */
function Sidebar({ mobileOpen, onClose }) {
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-control-gray bg-white transition-transform duration-250 ease-out md:sticky md:top-0 md:h-screen md:shrink-0 md:translate-x-0 ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* Brand Header */}
      <div className="flex h-20 items-center justify-between px-6 border-b border-control-gray/60">
        <Link to="/" onClick={onClose} className="transition-opacity hover:opacity-85" aria-label="Home">
          <BrandLockup />
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1.5 text-steel hover:text-ink md:hidden"
          aria-label="Close menu"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mb-2 px-3">
          <span className="font-display text-[11px] font-semibold uppercase tracking-wider text-slate/80">
            Workspace
          </span>
        </div>
        <nav className="space-y-1" aria-label="Sidebar Navigation">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-[16px] px-3.5 py-2.5 font-display text-[13.5px] font-medium transition-colors ${
                  isActive
                    ? 'bg-studio-mist font-semibold text-ink border border-control-gray'
                    : 'text-slate hover:bg-studio-mist/70 hover:text-ink'
                }`
              }
            >
              <span className="shrink-0">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Bottom Conversion & System Status */}
      <div className="p-4 border-t border-control-gray/60 space-y-3">
        <Link
          to="/send"
          onClick={onClose}
          className="btn-buy-cta w-full text-center !h-[38px] !text-[13px] font-semibold shadow-none"
        >
          + New Send
        </Link>
        <div className="flex items-center justify-center gap-2 text-[11.5px] text-slate py-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span>Relay Operational</span>
        </div>
      </div>
    </aside>
  );
}

/**
 * Apple-style Hero Banner.
 * Pure Gallery White backdrop, editorial SF Pro display typography,
 * compact Pricing Blue pill CTA + Outlined Explore pill.
 */
export function Hero({ eyebrow, title, lead, cta, secondary, aside }) {
  return (
    <section className="relative overflow-hidden bg-white border-b border-control-gray">
      <div className="mx-auto max-w-content px-6 py-10 sm:px-8 sm:py-12">
        <div className={aside ? 'grid items-center gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]' : 'max-w-3xl'}>
          <div className="space-y-4">
            {eyebrow ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-control-gray bg-studio-mist px-3 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-pricing-blue" />
                <span className="font-display text-[11px] font-semibold uppercase tracking-wider text-slate">
                  {eyebrow}
                </span>
              </div>
            ) : null}

            <h1 className="font-display text-[32px] font-semibold leading-[1.12] tracking-tight text-ink text-balance sm:text-[40px] lg:text-[44px]">
              {title}
            </h1>

            {lead ? (
              <p className="font-text text-[15px] font-normal leading-relaxed text-slate sm:text-[16px]">
                {lead}
              </p>
            ) : null}

            {cta || secondary ? (
              <div className="flex flex-wrap items-center gap-3 pt-2">
                {cta}
                {secondary}
              </div>
            ) : null}
          </div>

          {aside ? (
            <div className="lg:justify-self-end w-full max-w-md">
              <div className="rounded-[28px] border border-control-gray bg-white p-6 sm:p-7">
                {aside}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/**
 * Standard white band with comfortable padding for Apple card grids.
 */
export function Band({ children, className = '', tight = false }) {
  return (
    <section className={`mx-auto max-w-content px-6 sm:px-8 ${tight ? 'py-6 sm:py-8' : 'py-10 sm:py-14'} ${className}`}>
      {children}
    </section>
  );
}

/**
 * Main Application Layout:
 * - Replaced top navbar with Apple-style Left Sidebar.
 * - Removed footer completely.
 * - Studio Mist #f5f5f7 canvas.
 */
export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-studio-mist text-ink flex">
      {/* Sidebar for Desktop */}
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* Backdrop for Mobile Drawer */}
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile Header Bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-control-gray bg-white/90 px-4 backdrop-blur-md md:hidden">
          <Link to="/" className="transition-opacity hover:opacity-85">
            <BrandLockup />
          </Link>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-control-gray text-slate hover:text-ink"
            aria-label="Toggle navigation"
            onClick={() => setMobileOpen(true)}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </header>

        {/* Page Content */}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
