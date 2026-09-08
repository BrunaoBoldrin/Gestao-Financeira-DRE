import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { canAccessView } from '../../config/accessControl';
import type { ViewKey } from '../../types';

interface SidebarItem {
  key: ViewKey;
  label: string;
  icon: string;
  badge?: number;
}

interface SidebarGroup {
  groupName: string;
  items: SidebarItem[];
}

export const Sidebar: React.FC<{ mobileOpen: boolean; onClose: () => void }> = ({ mobileOpen, onClose }) => {
  useEffect(() => {
    if (!mobileOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [mobileOpen, onClose]);
  const { currentView, setCurrentView, documentosOCR, currentUser } = useApp();
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { if (mobileOpen) setCollapsed(false); }, [mobileOpen]);

  const pendingOCR = documentosOCR.filter((d) => d.status === 'PENDENTE_REVISAO').length;

  const menuGroups: SidebarGroup[] = [
    {
      groupName: 'VISÃO GERAL',
      items: [{ key: 'overview', label: 'Visão Geral', icon: 'dashboard' }]
    },
    {
      groupName: 'ENTRADA DE DOCUMENTOS',
      items: [
        { key: 'inbox', label: 'Caixa de Entrada', icon: 'inbox' },
        { key: 'pending_review', label: 'Pendências / OCR', icon: 'rule', badge: pendingOCR },
        { key: 'import_excel', label: 'Importar Excel', icon: 'file_upload' }
      ]
    },
    {
      groupName: 'LANÇAMENTOS & TÍTULOS',
      items: [
        { key: 'receitas', label: 'Receitas e Despesas', icon: 'swap_vert' },
        { key: 'caixa_fisico', label: 'Caixa Físico', icon: 'point_of_sale' }
      ]
    },
    {
      groupName: 'CONTROLADORIA & DRE',
      items: [
        { key: 'fluxo_caixa', label: 'Fluxo de Caixa', icon: 'show_chart' },
        { key: 'dre', label: 'DRE Gerencial', icon: 'analytics' },
        { key: 'documentos', label: 'Documentos (GED)', icon: 'folder_open' },
        { key: 'fechamento', label: 'Fechamentos Mensais', icon: 'lock_clock' }
      ]
    },
    {
      groupName: 'SISTEMA & AUDITORIA',
      items: [
        { key: 'cadastros', label: 'Cadastros', icon: 'list_alt' },
        { key: 'automacoes', label: 'Automações', icon: 'smart_toy' },
        { key: 'historico', label: 'Histórico & Auditoria', icon: 'history' },
        { key: 'usuarios', label: 'Usuários & Permissões', icon: 'manage_accounts' },
        { key: 'configuracoes', label: 'Configurações Gerais', icon: 'settings' }
      ]
    }
  ];

  const userRole = currentUser?.role || 'AUDITOR';
  const visibleMenuGroups = menuGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessView(userRole, item.key))
    }))
    .filter((group) => group.items.length > 0);

  return (
    <>
    {mobileOpen && <button aria-label="Fechar menu" onClick={onClose} className="fixed inset-0 bg-black/50 z-40 lg:hidden" />}
    <aside id="app-navigation" aria-label="Navegação principal"
      className={`${mobileOpen ? 'flex fixed inset-y-0 left-0 w-72 shadow-xl' : 'hidden'} lg:flex lg:static shrink-0 bg-[#0b1c30] text-gray-200 border-r border-[#131b2e] overflow-y-auto flex-col justify-between transition-all duration-300 z-40 select-none ${
        collapsed ? 'lg:w-16' : 'lg:w-64'
      }`}
    >
      {/* Brand Header */}
      <div>
        <button onClick={onClose} className="lg:hidden p-3 text-right" aria-label="Fechar menu"><span className="material-symbols-outlined">close</span></button>
        <div className="h-16 px-4 flex items-center justify-between border-b border-[#1a2e46] bg-[#071322]">
          {!collapsed && (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#C5A059] to-[#775a19] flex items-center justify-center font-bold text-white shadow-xs">
                RF
              </div>
              <div>
                <h1 className="text-sm font-extrabold text-white tracking-wide leading-tight">
                  Royal Face
                </h1>
                <p className="text-[10px] text-[#C5A059] font-medium tracking-wider uppercase">
                  Gestão Financeira & DRE
                </p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="w-8 h-8 rounded-lg bg-[#C5A059] flex items-center justify-center font-bold text-white mx-auto">
              RF
            </div>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:block p-1 rounded text-gray-400 hover:text-white hover:bg-[#131b2e] transition"
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            <span className="material-symbols-outlined text-lg">
              {collapsed ? 'chevron_right' : 'chevron_left'}
            </span>
          </button>
        </div>

        {/* Navigation List */}
        <div className="py-3 px-2 overflow-y-auto lg:max-h-[calc(100dvh-110px)] space-y-4">
          {visibleMenuGroups.map((group) => (
            <div key={group.groupName}>
              {!collapsed && (
                <p className="px-3 text-[10px] font-bold text-[#C5A059] tracking-wider uppercase mb-1.5 opacity-90">
                  {group.groupName}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = currentView === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => { setCurrentView(item.key); onClose(); }}
                      title={collapsed ? item.label : undefined}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-[#C5A059] text-white font-bold shadow-xs'
                          : 'text-gray-300 hover:bg-[#131b2e] hover:text-white'
                      }`}
                    >
                      <span className="material-symbols-outlined text-lg shrink-0">
                        {item.icon}
                      </span>

                      {!collapsed && <span className="truncate flex-1 text-left">{item.label}</span>}

                      {!collapsed && item.badge !== undefined && item.badge > 0 && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                            isActive ? 'bg-white text-[#775a19]' : 'bg-[#C5A059] text-white'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

    </aside>
    </>
  );
};
