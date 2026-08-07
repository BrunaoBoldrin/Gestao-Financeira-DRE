import type { UserRole, ViewKey } from '../types';

const ALL_ROLES: readonly UserRole[] = ['ADMIN', 'FINANCE', 'AUDITOR'];
const FINANCIAL_ROLES: readonly UserRole[] = ['ADMIN', 'FINANCE'];
const AUDIT_ROLES: readonly UserRole[] = ['ADMIN', 'AUDITOR'];
const ADMIN_ONLY: readonly UserRole[] = ['ADMIN'];

export const VIEW_PERMISSIONS: Record<ViewKey, readonly UserRole[]> = {
  overview: ALL_ROLES,
  inbox: FINANCIAL_ROLES,
  pending_review: FINANCIAL_ROLES,
  import_excel: FINANCIAL_ROLES,
  receitas: ALL_ROLES,
  despesas: ALL_ROLES,
  parcelamentos: ALL_ROLES,
  caixa_fisico: ALL_ROLES,
  fluxo_caixa: ALL_ROLES,
  dre: ALL_ROLES,
  documentos: ALL_ROLES,
  fechamento: ALL_ROLES,
  historico: AUDIT_ROLES,
  cadastros: ADMIN_ONLY,
  automacoes: ADMIN_ONLY,
  usuarios: ADMIN_ONLY,
  configuracoes: ADMIN_ONLY
};

export const ROLE_DEFAULT_VIEW: Record<UserRole, ViewKey> = {
  ADMIN: 'overview',
  FINANCE: 'overview',
  AUDITOR: 'overview'
};

export const canAccessView = (role: UserRole, view: ViewKey): boolean =>
  VIEW_PERMISSIONS[view].includes(role);

export const canAccessAllUnits = (role: UserRole): boolean =>
  role === 'ADMIN' || role === 'AUDITOR';
