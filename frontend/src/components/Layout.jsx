import { NavLink, Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { BrandLockup } from './AppleMark.jsx';
import { api } from '../lib/api.js';

const NAV = [
  {
    to: '/',
    label: 'Dashboard',
    end: true,
    icon: (
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    to: '/send',
    label: 'Send Flow',
    badge: 'Live',
    icon: (
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
      </svg>
    ),
  },
  {
    to: '/templates',
    label: 'Create a Mail',
    icon: (
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    to: '/campaigns',
    label: 'Campaigns',
    icon: (
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
];

export function Hero({ eyebrow, title, lead, cta, secondary, aside }) {
  return (
    <section className="relative overflow-hidden bg-white border-b border-slate-200">
      <div className="mx-auto max-w-content px-4 py-8 sm:px-6 lg:px-8">
        <div className={aside ? 'grid items-center gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)]' : 'max-w-4xl'}>
          <div className="space-y-3.5">
            {eyebrow ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1">
                <span className="h-2 w-2 rounded-full bg-[#00c269] animate-pulse" />
                <span className="font-display text-[11px] font-bold uppercase tracking-wider text-[#00a859]">
                  {eyebrow}
                </span>
              </div>
            ) : null}

            <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight text-slate-900 sm:text-[36px]">
              {title}
            </h1>

            {lead ? (
              <p className="font-text text-[15px] font-normal leading-relaxed text-slate-600 max-w-2xl">
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
              <div className="rounded-[16px] border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                {aside}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function Band({ children, className = '', tight = false }) {
  return (
    <section className={`mx-auto max-w-content px-4 sm:px-6 lg:px-8 ${tight ? 'py-5 sm:py-6' : 'py-8 sm:py-10'} ${className}`}>
      {children}
    </section>
  );
}

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [credits, setCredits] = useState(299);
  const [relayOk, setRelayOk] = useState(true);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Fetch live system status & remaining Brevo credits
  useEffect(() => {
    api.system.smtpCheck()
      .then((res) => {
        if (res?.smtp?.ok) setRelayOk(true);
        if (res?.account?.credits != null) setCredits(res.account.credits);
      })
      .catch(() => {});
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 flex flex-col font-sans">
      {/* -------------------------------------------------------------
          WATI Top Navigation Bar (matching reference image)
          ------------------------------------------------------------- */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md transition-shadow shadow-sm">
        <div className="mx-auto max-w-content px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            {/* Left: Brand Logo & Mobile Trigger */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 md:hidden"
                aria-label="Toggle navigation"
                onClick={() => setMobileOpen(!mobileOpen)}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
              <Link to="/" className="transition-opacity hover:opacity-90">
                <BrandLockup />
              </Link>
            </div>

            {/* Center: WATI Desktop Nav Links */}
            <nav className="hidden md:flex items-center gap-1.5" aria-label="Main Navigation">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-lg px-3.5 py-2 font-display text-[13.5px] font-semibold transition-all ${
                      isActive
                        ? 'border border-[#00c269] bg-[#e8f8f0] text-[#00a859] shadow-sm'
                        : 'border border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`
                  }
                >
                  <span className="shrink-0">{item.icon}</span>
                  <span>{item.label}</span>
                  {item.badge ? (
                    <span className="ml-1 rounded-full bg-[#00c269] px-1.5 py-0.2 text-[10px] font-bold text-white uppercase">
                      {item.badge}
                    </span>
                  ) : null}
                </NavLink>
              ))}
            </nav>

            {/* Right: Status Pills, Credits & Action CTA */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              {/* Relay Status Pill */}
              <div className="hidden lg:flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50/80 px-3 py-1 font-text text-[12px] text-slate-600 shadow-sm">
                <span className={`h-2 w-2 rounded-full ${relayOk ? 'bg-[#00c269] animate-pulse' : 'bg-red-500'}`} />
                <span>{relayOk ? 'Relay Active' : 'Relay Blocked'}</span>
              </div>

              {/* Credits Pill (matching image: Free conversation: 1000) */}
              <div className="hidden sm:flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-display text-[12px] font-semibold text-slate-700 shadow-sm">
                <span className="text-slate-400">Credits:</span>
                <span className="text-[#00a859] font-bold">{credits}</span>
              </div>

              {/* WATI Emerald Action Button */}
              <Link
                to="/send"
                className="btn-emerald !h-[36px] !px-3.5 !text-[13px] font-semibold shadow-sm"
              >
                + New Send
              </Link>

              {/* User Avatar Badge (matching WATI purple avatar in screenshot) */}
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 font-display text-[12px] font-bold text-white shadow-sm ring-2 ring-white"
                title="Watcha Account"
              >
                W
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileOpen ? (
          <div className="border-t border-slate-200 bg-white px-4 py-3 md:hidden space-y-1 shadow-lg animate-in fade-in duration-150">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 font-display text-[14px] font-semibold ${
                    isActive
                      ? 'border border-[#00c269] bg-[#e8f8f0] text-[#00a859]'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`
                }
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[12px] text-slate-500 px-3">
              <span>Remaining Credits: <strong className="text-[#00a859]">{credits}</strong></span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#00c269]" />
                Relay Active
              </span>
            </div>
          </div>
        ) : null}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full min-w-0">
        {children}
      </main>
    </div>
  );
}
