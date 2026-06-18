import { useState, type ReactNode } from 'react';
import { useStore } from '../../state/store';
import { SergesLogo, SergesMark } from './Logo';

type Dest = 'calendario' | 'contatos' | 'projetos' | 'feriados' | 'comercial';

function Icon({ path }: { path: ReactNode }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      {path}
    </svg>
  );
}

const ICONS: Record<Dest | 'oraculo', ReactNode> = {
  calendario: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></>,
  contatos: <><path d="M16 21v-2a4 4 0 0 0-8 0v2" /><circle cx="12" cy="7" r="4" /></>,
  projetos: <><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></>,
  feriados: <><path d="M4 4v16M4 4h13l-2 4 2 4H4" /></>,
  comercial: <><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-3" /><path d="M9 9v.01M9 12v.01M9 15v.01" /></>,
  oraculo: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>,
};

export function Sidebar({
  active,
  onNavigate,
}: {
  active: Dest;
  onNavigate: (d: Dest) => void;
}) {
  const store = useStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const itens: { id: Dest; label: string }[] = [
    { id: 'calendario', label: 'Calendário' },
    { id: 'contatos', label: 'Contatos' },
    { id: 'projetos', label: 'Projetos' },
    { id: 'feriados', label: 'Feriados' },
    { id: 'comercial', label: 'Setor Comercial Público' },
  ];

  const nav = (
    <nav className="flex h-full flex-col gap-1 p-3">
      <div className={`mb-2 flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-1 py-2`}>
        {collapsed ? <SergesMark size={26} /> : <SergesLogo />}
        <button
          className="btn-ghost hidden md:block"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          title={collapsed ? 'Expandir' : 'Recolher'}
        >
          <Icon path={collapsed ? <path d="M9 6l6 6-6 6" /> : <path d="M15 6l-6 6 6 6" />} />
        </button>
      </div>

      {itens.map((it) => (
        <button
          key={it.id}
          className="nav-item"
          data-active={active === it.id}
          onClick={() => {
            onNavigate(it.id);
            setMobileOpen(false);
          }}
          title={it.label}
        >
          <Icon path={ICONS[it.id]} />
          {!collapsed && <span>{it.label}</span>}
        </button>
      ))}

      <a className="nav-item mt-auto" href={store.config.oraculoUrl} target="_blank" rel="noreferrer" title="Oráculo (NotebookLM)">
        <Icon path={ICONS.oraculo} />
        {!collapsed && (
          <span className="flex items-center gap-1">
            Oráculo <span className="text-[var(--color-ink-faint)]">↗</span>
          </span>
        )}
      </a>
    </nav>
  );

  return (
    <>
      {/* Botão de menu no mobile */}
      <button
        className="btn-secondary fixed left-3 top-3 z-50 md:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menu"
      >
        <Icon path={<path d="M3 6h18M3 12h18M3 18h18" />} />
      </button>

      {/* Sidebar fixa (desktop) */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 border-r border-[var(--color-line)] bg-[var(--color-surface)] transition-[width] duration-200 md:block ${
          collapsed ? 'w-[68px]' : 'w-[224px]'
        }`}
      >
        {nav}
      </aside>

      {/* Off-canvas (mobile) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <aside className="absolute left-0 top-0 h-full w-[244px] border-r border-[var(--color-line)] bg-[var(--color-surface)]" onClick={(e) => e.stopPropagation()}>
            {nav}
          </aside>
        </div>
      )}
    </>
  );
}
