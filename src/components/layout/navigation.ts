import type { UserRole, ViewKey } from '../../types';
import { canAccessView } from '../../config/accessControl';

interface NavigationItem {
  key: ViewKey;
  label: string;
  icon: string;
}

const navigationGroups: { label: string; items: NavigationItem[] }[] = [
  {
    label: 'Visão geral',
    items: [{ key: 'overview', label: 'Visão Geral', icon: 'dashboard' }]
  },
  {
    label: 'Entrada de documentos',
    items: [
      { key: 'inbox', label: 'Caixa de Entrada', icon: 'inbox' },
      { key: 'pending_review', label: 'Pendências / OCR', icon: 'rule' },
      { key: 'import_excel', label: 'Importar Excel', icon: 'file_upload' }
    ]
  },
  {
    label: 'Lançamentos & títulos',
    items: [
      { key: 'receitas', label: 'Receitas e Despesas', icon: 'swap_vert' },
      { key: 'caixa_fisico', label: 'Caixa Físico', icon: 'point_of_sale' }
    ]
  },
  {
    label: 'Controladoria & DRE',
    items: [
      { key: 'fluxo_caixa', label: 'Fluxo de Caixa', icon: 'show_chart' },
      { key: 'dre', label: 'DRE Gerencial', icon: 'analytics' },
      { key: 'ponto_equilibrio', label: 'Ponto de Equilíbrio', icon: 'balance' },
      { key: 'documentos', label: 'Documentos (GED)', icon: 'folder_open' },
      { key: 'fechamento', label: 'Fechamentos Mensais', icon: 'lock_clock' }
    ]
  },
  {
    label: 'Sistema & auditoria',
    items: [
      { key: 'cadastros', label: 'Cadastros', icon: 'list_alt' },
      { key: 'automacoes', label: 'Automações', icon: 'smart_toy' },
      { key: 'historico', label: 'Histórico & Auditoria', icon: 'history' },
      { key: 'usuarios', label: 'Usuários & Permissões', icon: 'manage_accounts' },
      { key: 'configuracoes', label: 'Configurações', icon: 'settings' }
    ]
  }
];

export const getNavigationGroups = (role: UserRole) => navigationGroups
  .map(({ label, items }) => ({ label, items: items.filter((item) => canAccessView(role, item.key)) }))
  .filter(({ items }) => items.length > 0);

export function getViewLabel(view: ViewKey) {
  const key = view === 'despesas' ? 'receitas' : view;
  return navigationGroups.flatMap(({ items }) => items).find((item) => item.key === key)?.label || 'Financeiro';
}
