import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useApp } from '../../context/AppContext';
import { getNavigationGroups } from './navigation';
import type { TipoLancamento, ViewKey } from '../../types';

function NavigationSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, []);

  return (
    <dialog ref={ref} aria-label={title} className="mobile-nav-sheet desktop:hidden"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <div className="space-y-4 px-4 pt-2 sm:px-6">
        <div aria-hidden="true" className="mx-auto h-1 w-9 rounded-full bg-[#d3dce8]" />
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold tracking-tight text-[#0b1c30]">{title}</h2>
          <button type="button" aria-label="Fechar painel" onClick={onClose}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-[#eff4ff] text-[#0b1c30] hover:bg-[#e5eeff]">
            <span aria-hidden="true" className="material-symbols-outlined">close</span>
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

const tabClass = 'flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 text-[10px] font-bold text-slate-600 transition hover:bg-[#eff4ff] sm:text-xs';

interface MobileNavigationProps {
  onOpenNew: (type: TipoLancamento) => void;
  onOpenUpload: () => void;
}

export function MobileNavigation({ onOpenNew, onOpenUpload }: MobileNavigationProps) {
  const { currentView, setCurrentView, documentosOCR, currentUser, canExecuteFinancialActions } = useApp();
  const [sheet, setSheet] = useState<'more' | 'new' | null>(null);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1280px) and (pointer: fine)');
    const handleResize = (event: MediaQueryListEvent) => { if (event.matches) setSheet(null); };
    desktop.addEventListener('change', handleResize);
    return () => desktop.removeEventListener('change', handleResize);
  }, []);
  if (!currentUser) return null;

  const finance = currentUser.role === 'FINANCE';
  const pending = documentosOCR.filter((item) => item.status === 'PENDENTE_REVISAO').length;
  const primaryViews: ViewKey[] = [finance ? 'inbox' : 'overview', 'receitas', 'configuracoes'];
  if (!canExecuteFinancialActions) primaryViews.push('dre');
  const current = currentView === 'despesas' ? 'receitas' : currentView;
  const go = (view: ViewKey) => {
    setSheet(null);
    if (view === current) window.scrollTo(0, 0);
    setCurrentView(view);
  };
  const run = (action: () => void) => {
    setSheet(null);
    action();
  };

  const tab = (key: ViewKey, label: string, icon: string, accessibleName = label) => (
    <button type="button" aria-label={accessibleName} aria-current={current === key ? 'page' : undefined}
      onClick={() => go(key)}
      className={`${tabClass} ${current === key ? 'bg-[#eff4ff] text-[#0b1c30]' : ''}`}>
      <span aria-hidden="true" className="material-symbols-outlined">{icon}</span>
      {label}
    </button>
  );

  return (
    <>
      <nav aria-label="Navegação inferior" className="mobile-bottom-nav desktop:hidden">
        <div className="mx-auto grid max-w-[760px] grid-cols-5 items-end gap-1 px-1 sm:gap-3">
          {finance ? tab('receitas', 'Lançamentos', 'swap_vert') : tab('overview', 'Início', 'dashboard')}
          {finance ? tab('inbox', 'Entrada', 'inbox', 'Caixa de Entrada') : tab('receitas', 'Lançamentos', 'swap_vert')}
          {canExecuteFinancialActions ? (
            <button type="button" aria-label="Novo" aria-haspopup="dialog" aria-expanded={sheet === 'new'}
              onClick={() => setSheet('new')} className={tabClass + ' text-[#0b1c30]'}>
              <span className="grid size-9 place-items-center rounded-xl bg-[#0b1c30] text-[#ffdea5] shadow-sm sm:size-10">
                <span aria-hidden="true" className="material-symbols-outlined">add</span>
              </span>
              Novo
            </button>
          ) : tab('dre', 'DRE', 'analytics', 'DRE Gerencial')}
          {tab('configuracoes', 'Ajustes', 'settings', 'Configurações')}
          <button type="button" aria-haspopup="dialog" aria-expanded={sheet === 'more'} onClick={() => setSheet('more')}
            aria-current={!primaryViews.includes(current) ? 'page' : undefined}
            className={`${tabClass} ${!primaryViews.includes(current) ? 'bg-[#eff4ff] text-[#0b1c30]' : ''}`}>
            <span aria-hidden="true" className="material-symbols-outlined">more_horiz</span>
            Mais
          </button>
        </div>
      </nav>

      {sheet === 'new' && canExecuteFinancialActions && (
        <NavigationSheet title="Novo" onClose={() => setSheet(null)}>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { label: 'Nova receita', icon: 'trending_up', action: () => onOpenNew('RECEITA'), color: 'text-emerald-700' },
              { label: 'Nova despesa', icon: 'trending_down', action: () => onOpenNew('DESPESA'), color: 'text-rose-700' },
              { label: 'Enviar documento', icon: 'upload_file', action: onOpenUpload, color: 'text-[#775a19]' },
              { label: 'Importar Excel', icon: 'table_chart', action: () => go('import_excel'), color: 'text-blue-700' }
            ].map(({ label, icon, action, color }) => (
              <button key={label} type="button" onClick={() => run(action)}
                className="flex min-h-20 min-w-0 flex-col items-start justify-center gap-2 rounded-xl border border-[#dbe5f1] bg-[#f8faff] p-3 text-left text-sm font-bold text-[#0b1c30] hover:border-[#c5a059] hover:bg-[#fffbf1]">
                <span aria-hidden="true" className={`material-symbols-outlined ${color}`}>{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </NavigationSheet>
      )}

      {sheet === 'more' && (
        <NavigationSheet title="Mais funcionalidades" onClose={() => setSheet(null)}>
          <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
            {getNavigationGroups(currentUser.role).map(({ label, items }) => (
              <section key={label}>
                <h3 className="mb-1 text-xs font-bold text-slate-500">{label}</h3>
                <div className="space-y-1">
                  {items.map((item) => (
                    <button key={item.key} type="button" onClick={() => go(item.key)} aria-current={current === item.key ? 'page' : undefined}
                      className={`flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-semibold text-[#0b1c30] ${current === item.key ? 'bg-[#eff4ff]' : 'hover:bg-[#f8faff]'}`}>
                      <span aria-hidden="true" className="material-symbols-outlined shrink-0 text-slate-600">{item.icon}</span>
                      <span className="min-w-0 flex-1">{item.label}</span>
                      {item.key === 'pending_review' && pending > 0 &&
                        <span className="rounded-full bg-[#ffdea5] px-2 py-0.5 text-xs font-bold text-[#775a19]">{pending}</span>}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </NavigationSheet>
      )}
    </>
  );
}
