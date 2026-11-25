import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { getNavigationGroups } from './navigation';

export function Sidebar() {
  const { currentView, setCurrentView, documentosOCR, currentUser } = useApp();
  const [collapsed, setCollapsed] = useState(false);
  if (!currentUser) return null;

  const pending = documentosOCR.filter((item) => item.status === 'PENDENTE_REVISAO').length;

  return (
    <aside className={`hidden shrink-0 border-r border-[#131b2e] bg-[#0b1c30] text-gray-200 desktop:block ${collapsed ? 'w-16' : 'w-64'}`}>
      <div className="sticky top-[var(--desktop-header-height)] overflow-y-auto max-h-[calc(100dvh-var(--desktop-header-height))]">
        <div className="flex h-16 items-center justify-between gap-2 border-b border-[#1a2e46] bg-[#071322] px-4">
          {!collapsed && (
            <div className="flex min-w-0 items-center gap-2.5">
              <img src="/icons/app-192.png" alt="" className="size-9 shrink-0 rounded-lg" />
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-white">Royal Face</p>
                <p className="truncate text-[10px] font-medium uppercase tracking-wider text-[#C5A059]">Gestão Financeira & DRE</p>
              </div>
            </div>
          )}
          <button type="button" onClick={() => setCollapsed(!collapsed)} className="shrink-0 rounded p-1 text-gray-400 hover:bg-[#131b2e] hover:text-white"
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}>
            <span aria-hidden="true" className="material-symbols-outlined text-lg">{collapsed ? 'chevron_right' : 'chevron_left'}</span>
          </button>
        </div>
        <nav id="app-navigation" aria-label="Navegação principal" className="space-y-4 px-2 py-3">
          {getNavigationGroups(currentUser.role).map(({ label, items }) => (
            <div key={label} className="space-y-0.5">
              {!collapsed && <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-[#C5A059]">{label}</p>}
              {items.map((item) => {
                const active = currentView === item.key || (item.key === 'receitas' && currentView === 'despesas');
                return (
                  <button key={item.key} type="button" onClick={() => setCurrentView(item.key)}
                    title={collapsed ? item.label : undefined} aria-label={item.label} aria-current={active ? 'page' : undefined}
                    className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-xs font-medium transition ${active ? 'bg-[#C5A059] font-bold text-[#0b1c30]' : 'text-gray-300 hover:bg-[#131b2e] hover:text-white'}`}>
                    <span aria-hidden="true" className="material-symbols-outlined shrink-0 text-lg">{item.icon}</span>
                    {!collapsed && <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>}
                    {!collapsed && item.key === 'pending_review' && pending > 0 &&
                      <span className="rounded-full bg-[#ffdea5] px-1.5 text-[10px] font-bold text-[#775a19]">{pending}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}
