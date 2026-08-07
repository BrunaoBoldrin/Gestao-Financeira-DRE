import React, { useState } from 'react';
import { useApp, ViewKey } from '../../context/AppContext';

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

export const Sidebar: React.FC = () => {
  const { currentView, setCurrentView, documentosOCR } = useApp();
  const [collapsed, setCollapsed] = useState(false);

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
        { key: 'pending_review', label: 'Pendências / OCR', icon: 'rule', badge: pendingOCR }
      ]
    },
    {
      groupName: 'LANÇAMENTOS & TÍTULOS',
      items: [
        { key: 'receitas', label: 'Receitas', icon: 'trending_up' },
        { key: 'despesas', label: 'Despesas', icon: 'trending_down' },
        { key: 'parcelamentos', label: 'Parcelamentos', icon: 'view_kanban' },
        { key: 'caixa_fisico', label: 'Caixa Físico', icon: 'point_of_sale' },
        { key: 'import_excel', label: 'Importar Excel', icon: 'file_upload' }
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

  return (
    <aside
      className={`bg-[#0b1c30] text-gray-200 border-r border-[#131b2e] flex flex-col justify-between transition-all duration-300 z-40 select-none ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div>
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
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#131b2e] transition"
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            <span className="material-symbols-outlined text-lg">
              {collapsed ? 'chevron_right' : 'chevron_left'}
            </span>
          </button>
        </div>

        {/* Navigation List */}
        <div className="py-3 px-2 overflow-y-auto max-h-[calc(100vh-110px)] space-y-4">
          {menuGroups.map((group, idx) => (
            <div key={idx}>
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
                      onClick={() => setCurrentView(item.key)}
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

      {/* Footer Info */}
      <div className="p-3 border-t border-[#1a2e46] bg-[#071322] text-[11px] text-gray-400 text-center">
        {!collapsed ? (
          <div>
            <p className="font-semibold text-gray-300">Enterprise v2.4</p>
            <p className="text-[10px] text-gray-500">Conformidade NBC TG 26</p>
          </div>
        ) : (
          <span className="material-symbols-outlined text-gray-500">verified</span>
        )}
      </div>
    </aside>
  );
};
