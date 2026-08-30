import Link from 'next/link';
import { useRouter } from 'next/router';
import { useContext, useState, useRef, useEffect, useCallback } from 'react';
import { SidebarContext } from '../pages/_app';

const NAV_ICONS = {
  dashboard: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 13a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6z" />
    </svg>
  ),
  catalog: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  customers: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  audit: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  ),
  campaign: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
    </svg>
  ),
  buyer: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  failures: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  chat: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  demo: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  fraud: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
};

const ALL_LINKS = [
  { href: '/',          label: 'Dashboard', icon: 'dashboard', section: 'menu' },
  { href: '/catalog',   label: 'Catalog',   icon: 'catalog',   section: 'menu' },
  { href: '/customers', label: 'Customers', icon: 'customers', section: 'menu' },
  { href: '/audit',     label: 'Audit Trail', icon: 'audit',   section: 'menu' },
  { href: '/campaign',  label: 'Campaign',  icon: 'campaign',  section: 'menu' },
  { href: '/buyer',     label: 'AI Buyer',  icon: 'buyer',     section: 'menu' },
  { href: '/failures',  label: 'Failures',  icon: 'failures',  section: 'menu' },
  { href: '/chat',      label: 'Chat',      icon: 'chat',      section: 'menu' },
  { href: '/demo',      label: 'Demo',      icon: 'demo',      section: 'tools' },
  { href: '/fraud',     label: 'Fraud Detection', icon: 'fraud', section: 'tools' },
];

const PROXIMITY_RADIUS = 100;
const MAX_SHIFT = 14;
const SMOOTHING_FACTOR = 0.12;

const smoothFalloff = p => p * p * (3 - 2 * p);

const SearchIcon = () => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const CollapseIcon = ({ collapsed }) => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"
    style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s ease' }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);

function useLineSidebarEffect(navRef, itemRefs, collapsed) {
  const mouseY = useRef(-9999);
  const currentEffects = useRef([]);
  const targetEffects = useRef([]);
  const rafId = useRef(null);
  const isInside = useRef(false);
  const collapsedRef = useRef(collapsed);

  useEffect(() => {
    collapsedRef.current = collapsed;
  }, [collapsed]);

  const animate = useCallback(() => {
    const items = itemRefs.current;
    if (!items.length) { rafId.current = null; return; }

    let needsUpdate = false;
    for (let i = 0; i < items.length; i++) {
      const el = items[i];
      if (!el) continue;

      if (currentEffects.current[i] === undefined) currentEffects.current[i] = 0;
      if (targetEffects.current[i] === undefined) targetEffects.current[i] = 0;

      if (isInside.current && !collapsedRef.current) {
        const rect = el.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        const dist = Math.abs(mouseY.current - center);
        const raw = Math.max(0, 1 - dist / PROXIMITY_RADIUS);
        targetEffects.current[i] = smoothFalloff(raw);
      } else {
        targetEffects.current[i] = 0;
      }

      const diff = targetEffects.current[i] - currentEffects.current[i];
      if (Math.abs(diff) > 0.001) {
        currentEffects.current[i] += diff * SMOOTHING_FACTOR;
        needsUpdate = true;
      } else {
        currentEffects.current[i] = targetEffects.current[i];
      }

      el.style.setProperty('--effect', currentEffects.current[i].toFixed(3));
    }

    if (needsUpdate) {
      rafId.current = requestAnimationFrame(animate);
    } else {
      rafId.current = null;
    }
  }, [itemRefs]);

  const kick = useCallback(() => {
    if (!rafId.current) rafId.current = requestAnimationFrame(animate);
  }, [animate]);

  useEffect(() => {
    kick();
  }, [collapsed, kick]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const onMove = (e) => {
      mouseY.current = e.clientY;
      isInside.current = true;
      kick();
    };
    const onLeave = () => {
      isInside.current = false;
      kick();
    };

    nav.addEventListener('mousemove', onMove);
    nav.addEventListener('mouseleave', onLeave);

    return () => {
      nav.removeEventListener('mousemove', onMove);
      nav.removeEventListener('mouseleave', onLeave);
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
    };
  }, [navRef, kick]);
}

export default function Nav() {
  const router = useRouter();
  const { pathname } = router;
  const { collapsed, setCollapsed } = useContext(SidebarContext);
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef(null);
  const sidebarRef = useRef(null);
  const itemRefs = useRef([]);

  const q = search.toLowerCase().trim();
  const filteredLinks = q ? ALL_LINKS.filter(l => l.label.toLowerCase().includes(q)) : ALL_LINKS;

  const setItemRef = useCallback((idx) => (el) => {
    itemRefs.current[idx] = el;
  }, []);

  useLineSidebarEffect(sidebarRef, itemRefs, collapsed);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (collapsed) setCollapsed(false);
        setTimeout(() => searchRef.current?.focus(), 100);
      }
      if (e.key === 'Escape' && searchFocused) {
        setSearch('');
        searchRef.current?.blur();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [collapsed, setCollapsed, searchFocused]);

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && filteredLinks.length === 1) {
      router.push(filteredLinks[0].href);
      setSearch('');
      searchRef.current?.blur();
    }
  };

  const menuLinks = filteredLinks.filter(l => l.section === 'menu');
  const toolLinks = filteredLinks.filter(l => l.section === 'tools');
  const hasResults = filteredLinks.length > 0;
  let itemIdx = 0;

  return (
    <aside ref={sidebarRef} className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <span className="sidebar-logo-icon" style={{ background: 'transparent', padding: 0 }}>
          <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
            <style>{`
              @keyframes logoRingSpin {
                0%   { transform: rotate(-300deg); }
                24%  { transform: rotate(60deg); }
                100% { transform: rotate(60deg); }
              }
              .logo-ring {
                transform-origin: 17px 17px;
                animation: logoRingSpin 5s cubic-bezier(0.4,0,0.2,1) infinite;
              }
            `}</style>
            <circle cx="17" cy="17" r="17" fill="#1677C8" />
            <circle
              className="logo-ring"
              cx="17" cy="17" r="11.5"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="60 12"
            />
            <path d="M18 8L11.5 17.5H17L15.5 26L22.5 16H17.5L18 8Z" fill="white" />
          </svg>
        </span>
        <span className="sidebar-logo-text">FitIndia AI</span>
      </div>

      {/* Collapse toggle */}
      <button
        className="sidebar-collapse-btn"
        onClick={() => setCollapsed(c => !c)}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <CollapseIcon collapsed={collapsed} />
      </button>

      {/* Search */}
      {collapsed ? (
        <button
          className="sidebar-search-icon-btn"
          onClick={() => { setCollapsed(false); setTimeout(() => searchRef.current?.focus(), 150); }}
          title="Search (Ctrl+K)"
        >
          <SearchIcon />
        </button>
      ) : (
        <div className={`sidebar-search${searchFocused ? ' focused' : ''}`}>
          <span className="sidebar-search-icon"><SearchIcon /></span>
          <input
            ref={searchRef}
            type="text"
            className="sidebar-search-input"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            onKeyDown={handleSearchKeyDown}
          />
          {!search && <kbd className="sidebar-search-kbd">Ctrl K</kbd>}
          {search && (
            <button className="sidebar-search-clear" onClick={() => { setSearch(''); searchRef.current?.focus(); }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {menuLinks.length > 0 && (
        <>
          <div className="sidebar-section-label">MENU</div>
          <nav className="sidebar-nav line-sidebar">
            {menuLinks.map(({ href, label, icon }) => {
              const idx = itemIdx++;
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  ref={setItemRef(idx)}
                  className={`sidebar-link line-sidebar__item${isActive ? ' active' : ''}`}
                  title={collapsed ? label : undefined}
                >
                  <span className="line-sidebar__marker" />
                  <span className="sidebar-link-icon">{NAV_ICONS[icon]}</span>
                  <span className="sidebar-link-label">{label}</span>
                </Link>
              );
            })}
          </nav>
        </>
      )}

      {toolLinks.length > 0 && (
        <>
          <div className="sidebar-divider" />
          <div className="sidebar-section-label">TOOLS</div>
          <nav className="sidebar-nav line-sidebar">
            {toolLinks.map(({ href, label, icon }) => {
              const idx = itemIdx++;
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  ref={setItemRef(idx)}
                  className={`sidebar-link line-sidebar__item sidebar-link-demo${isActive ? ' active' : ''}`}
                  title={collapsed ? label : undefined}
                >
                  <span className="line-sidebar__marker" />
                  <span className="sidebar-link-icon">{NAV_ICONS[icon]}</span>
                  <span className="sidebar-link-label">{label}</span>
                </Link>
              );
            })}
          </nav>
        </>
      )}

      {q && !hasResults && (
        <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
          No results for &ldquo;{search}&rdquo;
        </div>
      )}

      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', opacity: 0.75 }}>
          <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>Powered by</span>
          <svg width="18" height="18" viewBox="0 0 40 64" xmlns="http://www.w3.org/2000/svg">
            <polygon points="6,2 18,2 10,62 0,62" fill="rgba(255,255,255,0.4)" />
            <polygon points="18,2 30,2 14,62 10,62 18,24" fill="#1677C8" />
          </svg>
          <span style={{ fontSize: '0.88rem', fontWeight: 800, fontStyle: 'italic', color: 'rgba(255,255,255,0.85)', letterSpacing: '-0.2px', fontFamily: "'Inter','Segoe UI',Arial,sans-serif" }}>Razorpay</span>
        </div>
      </div>
    </aside>
  );
}
