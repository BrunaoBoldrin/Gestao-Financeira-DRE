import React, { createContext, useContext, useState } from 'react';
import {
  User,
  Lancamento,
  StatusLancamento,
  Parcelamento,
  DocumentoOCR,
  SessaoCaixaFisico,
  FechamentoMensal,
  AuditLog,
  RegraAutomacao,
  DREItem,
  UnitConfig,
  CategoriaMaster,
  CentroCustoMaster,
  FornecedorMaster,
  BancoMaster,
  CondicaoPagamento,
  ViewKey,
  DetalhesMovimentacaoCaixa
} from '../types';
import { ROLE_DEFAULT_VIEW, canAccessAllUnits, canAccessView } from '../config/accessControl';
import { calculateDueDateSchedule } from '../utils/financialDates';
import {
  INITIAL_USERS,
  INITIAL_UNITS,
  INITIAL_LANCAMENTOS,
  INITIAL_PARCELAMENTOS,
  INITIAL_DOCUMENTS_OCR,
  INITIAL_SESSAO_CAIXA,
  INITIAL_FECHAMENTO,
  INITIAL_AUDIT_LOGS,
  INITIAL_AUTOMATIONS,
  INITIAL_DRE,
  INITIAL_CATEGORIAS,
  INITIAL_CENTROS_CUSTO,
  INITIAL_FORNECEDORES,
  INITIAL_BANCOS,
  INITIAL_CONDICOES_PAGAMENTO
} from '../data/initialData';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AppContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  selectedUnit: string;
  setSelectedUnit: (unit: string) => void;
  currentView: ViewKey;
  setCurrentView: (view: ViewKey) => void;
  selectedDocumentForReviewId: string | null;
  setSelectedDocumentForReviewId: (id: string | null) => void;
  
  units: UnitConfig[];
  categorias: CategoriaMaster[];
  centrosCusto: CentroCustoMaster[];
  fornecedores: FornecedorMaster[];
  bancos: BancoMaster[];
  condicoesPagamento: CondicaoPagamento[];
  
  lancamentos: Lancamento[];
  filteredLancamentos: Lancamento[];
  parcelamentos: Parcelamento[];
  filteredParcelamentos: Parcelamento[];
  documentosOCR: DocumentoOCR[];
  sessaoCaixa: SessaoCaixaFisico;
  fechamentoMensal: FechamentoMensal;
  auditLogs: AuditLog[];
  regrasAutomacao: RegraAutomacao[];
  dreData: DREItem[];
  users: User[];
  
  toasts: Toast[];
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  
  // Permission Flags (RBAC)
  isAdmin: boolean;
  isFinance: boolean;
  isAuditor: boolean;
  canExecuteFinancialActions: boolean;
  canManageAdminSettings: boolean;
  
  // Master CRUDs
  addUnit: (u: Omit<UnitConfig, 'id'>) => void;
  updateUnit: (id: string, u: Partial<UnitConfig>) => void;
  toggleUnitActive: (id: string) => void;
  deleteUnit: (id: string) => void;

  addCategoria: (c: Omit<CategoriaMaster, 'id'>) => void;
  updateCategoria: (id: string, c: Partial<CategoriaMaster>) => void;
  toggleCategoriaActive: (id: string) => void;
  deleteCategoria: (id: string) => void;

  addCentroCusto: (cc: Omit<CentroCustoMaster, 'id'>) => void;
  updateCentroCusto: (id: string, cc: Partial<CentroCustoMaster>) => void;
  toggleCentroCustoActive: (id: string) => void;
  deleteCentroCusto: (id: string) => void;

  addFornecedor: (f: Omit<FornecedorMaster, 'id'>) => void;
  updateFornecedor: (id: string, f: Partial<FornecedorMaster>) => void;
  toggleFornecedorActive: (id: string) => void;
  deleteFornecedor: (id: string) => void;

  addBanco: (b: Omit<BancoMaster, 'id'>) => void;
  updateBanco: (id: string, b: Partial<BancoMaster>) => void;
  toggleBancoActive: (id: string) => void;
  deleteBanco: (id: string) => void;

  addCondicaoPagamento: (c: Omit<CondicaoPagamento, 'id'>) => void;
  updateCondicaoPagamento: (id: string, c: Partial<CondicaoPagamento>) => void;
  toggleCondicaoPagamentoActive: (id: string) => void;
  deleteCondicaoPagamento: (id: string) => void;

  // Actions
  addLancamento: (l: Omit<Lancamento, 'id' | 'criadoEm'>) => void;
  addLancamentoComDDL: (
    dadosBase: Omit<Lancamento, 'id' | 'criadoEm'>,
    dataEmissao: string,
    prazosDias: number[],
    primeiroVencimento?: string
  ) => void;
  addLancamentoComParcelamento: (l: Omit<Lancamento, 'id' | 'criadoEm'>, numeroParcelas: number) => void;
  addTransferencia: (dados: {
    origemBancoId: string;
    destinoBancoId: string;
    valor: number;
    data: string;
    descricao: string;
    unidade: string;
    comprovanteUrl?: string;
    documentoRef?: string;
  }) => void;
  updateLancamento: (id: string, l: Partial<Lancamento>) => void;
  deleteLancamento: (id: string) => void;
  marcarLancamentoComoPago: (id: string) => void;
  
  addParcelamento: (p: Omit<Parcelamento, 'id' | 'parcelasPagas' | 'status' | 'cronograma'>) => void;
  pagarParcela: (parcelamentoId: string, numeroParcela: number) => void;
  
  uploadDocumentoOCR: (file: File) => void;
  aprovarDocumentoOCR: (docId: string, dadosFinal: DocumentoOCR['dadosExtraidos']) => void;
  conciliarDocumentoOCR: (
    docId: string,
    lancamentoId: string,
    dadosFinal: DocumentoOCR['dadosExtraidos'],
    bancoId: string,
    justificativa?: string
  ) => void;
  rejeitarDocumentoOCR: (docId: string) => void;
  
  registrarMovimentacaoCaixa: (
    tipo: 'SUPRIMENTO' | 'SANGRIA' | 'VENDA' | 'DESPESA',
    descricao: string,
    valor: number,
    comprovanteRef?: string,
    detalhes?: DetalhesMovimentacaoCaixa
  ) => void;
  ajustarSaldoCaixa: (dados: {
    unidade: string;
    novoSaldo: number;
    motivo: string;
    comprovanteRef?: string;
  }) => void;
  
  toggleChecklistItemFechamento: (chkId: string) => void;
  travarFechamentoMensal: () => void;
  reabrirFechamentoMensal: () => void;
  
  addAuditLog: (modulo: string, acao: AuditLog['acao'], descricao: string, valorAnterior?: string, valorNovo?: string) => void;
  
  toggleRegraAutomacao: (id: string) => void;
  addRegraAutomacao: (r: Omit<RegraAutomacao, 'id'>) => void;
  
  addUser: (u: Omit<User, 'id' | 'lastAccess'>) => void;
  updateUser: (id: string, u: Partial<Omit<User, 'id' | 'lastAccess'>>) => void;
  toggleUserActive: (id: string) => void;
  deleteUser: (id: string) => void;

  exportBackupJSON: () => string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUserState] = useState<User | null>(INITIAL_USERS[0]);
  const [selectedUnit, setSelectedUnitState] = useState<string>('Todas as Unidades');
  const [currentView, setCurrentViewState] = useState<ViewKey>('overview');
  const [selectedDocumentForReviewId, setSelectedDocumentForReviewId] = useState<string | null>('ocr-101');
  
  const [units, setUnits] = useState<UnitConfig[]>(INITIAL_UNITS);
  const [categorias, setCategorias] = useState<CategoriaMaster[]>(INITIAL_CATEGORIAS);
  const [centrosCusto, setCentrosCusto] = useState<CentroCustoMaster[]>(INITIAL_CENTROS_CUSTO);
  const [fornecedores, setFornecedores] = useState<FornecedorMaster[]>(INITIAL_FORNECEDORES);
  const [bancos, setBancos] = useState<BancoMaster[]>(INITIAL_BANCOS);
  const [condicoesPagamento, setCondicoesPagamento] = useState<CondicaoPagamento[]>(INITIAL_CONDICOES_PAGAMENTO);
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>(INITIAL_LANCAMENTOS);
  const [parcelamentos, setParcelamentos] = useState<Parcelamento[]>(INITIAL_PARCELAMENTOS);
  const [documentosOCR, setDocumentosOCR] = useState<DocumentoOCR[]>(INITIAL_DOCUMENTS_OCR);
  const [sessaoCaixa, setSessaoCaixa] = useState<SessaoCaixaFisico>(INITIAL_SESSAO_CAIXA);
  const [fechamentoMensal, setFechamentoMensal] = useState<FechamentoMensal>(INITIAL_FECHAMENTO);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);
  const [regrasAutomacao, setRegrasAutomacao] = useState<RegraAutomacao[]>(INITIAL_AUTOMATIONS);
  const [dreData] = useState<DREItem[]>(INITIAL_DRE);
  
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Filtering Logic
  const filteredLancamentos = lancamentos.filter((l) => {
    return selectedUnit === 'Todas as Unidades' || l.unidade === selectedUnit;
  });

  const filteredParcelamentos = parcelamentos.filter((p) => {
    return selectedUnit === 'Todas as Unidades' || p.unidade === selectedUnit;
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Permission / Role Calculation (RBAC)
  const userRole = currentUser?.role || 'AUDITOR';
  const isAdmin = userRole === 'ADMIN';
  const isFinance = userRole === 'FINANCE';
  const isAuditor = userRole === 'AUDITOR';
  const canExecuteFinancialActions = isAdmin || isFinance;
  const canManageAdminSettings = isAdmin;

  const setCurrentUser = (user: User | null) => {
    if (user && !user.active) {
      showToast('Acesso negado: esta conta está inativa.', 'error');
      return;
    }

    setCurrentUserState(user);
    setSelectedDocumentForReviewId(null);

    if (!user) {
      setCurrentViewState('overview');
      setSelectedUnitState('Todas as Unidades');
      return;
    }

    setCurrentViewState(ROLE_DEFAULT_VIEW[user.role]);
    setSelectedUnitState(canAccessAllUnits(user.role) ? 'Todas as Unidades' : user.unit);
  };

  const setSelectedUnit = (unit: string) => {
    if (isFinance && currentUser && unit !== currentUser.unit) {
      showToast('Acesso negado: o perfil Financeiro está limitado à sua unidade.', 'error');
      setSelectedUnitState(currentUser.unit);
      return;
    }

    setSelectedUnitState(unit);
  };

  const setCurrentView = (view: ViewKey) => {
    if (!canAccessView(userRole, view)) {
      showToast('Acesso negado: esta página não está disponível para o seu perfil.', 'error');
      setCurrentViewState(ROLE_DEFAULT_VIEW[userRole]);
      return;
    }

    setCurrentViewState(view);
  };

  const resolveAllowedUnit = (requestedUnit: string): string => {
    if (isFinance && currentUser) return currentUser.unit;
    return requestedUnit || 'Royal Face - Matriz';
  };

  const canManageUnit = (unit: string, actionName: string): boolean => {
    if (isFinance && currentUser && unit !== currentUser.unit) {
      showToast(`Acesso negado: "${actionName}" pertence a outra unidade.`, 'error');
      return false;
    }
    return true;
  };

  const checkAdminPermission = (actionName: string): boolean => {
    if (!isAdmin) {
      showToast(`Acesso negado: "${actionName}" é uma ação restrita a Administradores.`, 'error');
      return false;
    }
    return true;
  };

  const checkFinancialPermission = (actionName: string): boolean => {
    if (isAuditor) {
      showToast(`Acesso negado: Perfil Auditoria possui apenas acesso de leitura.`, 'error');
      return false;
    }
    return true;
  };

  const addAuditLog = (
    modulo: string,
    acao: AuditLog['acao'],
    descricao: string,
    valorAnterior?: string,
    valorNovo?: string
  ) => {
    const newLog: AuditLog = {
      id: 'log-' + Date.now(),
      dataHora: new Date().toISOString().replace('T', ' ').substring(0, 19),
      usuario: currentUser ? currentUser.name : 'Sistema / OCR',
      acao,
      modulo,
      descricao,
      valorAnterior,
      valorNovo,
      ip: '189.120.45.10'
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const resolveBancoForLancamento = (
    lancamento: Pick<Lancamento, 'bancoId' | 'contaBancaria' | 'unidade'>
  ): BancoMaster | undefined => {
    const normalizedName = lancamento.contaBancaria?.trim().toLocaleLowerCase('pt-BR');
    const byId = lancamento.bancoId
      ? bancos.find((banco) => banco.id === lancamento.bancoId && banco.unidade === lancamento.unidade)
      : undefined;
    if (byId) return byId;

    const byName = normalizedName
      ? bancos.find(
          (banco) =>
            banco.unidade === lancamento.unidade &&
            banco.banco.trim().toLocaleLowerCase('pt-BR') === normalizedName
        )
      : undefined;
    if (byName) return byName;

    const unitAccounts = bancos.filter((banco) => banco.unidade === lancamento.unidade && banco.ativo);
    return unitAccounts.length === 1 ? unitAccounts[0] : undefined;
  };

  const bindLancamentoToBanco = <T extends Pick<Lancamento, 'bancoId' | 'contaBancaria' | 'unidade'>>(
    lancamento: T
  ): T => {
    const banco = resolveBancoForLancamento(lancamento);
    return {
      ...lancamento,
      bancoId: banco?.id,
      contaBancaria: banco?.banco || lancamento.contaBancaria
    };
  };

  const adjustBancoBalance = (bancoId: string, delta: number, reason: string) => {
    const banco = bancos.find((item) => item.id === bancoId);
    if (!banco || delta === 0) return;

    setBancos((prev) =>
      prev.map((item) => (item.id === bancoId ? { ...item, saldo: item.saldo + delta } : item))
    );
    addAuditLog(
      'Contas Bancárias',
      'CONCILIACAO',
      `${reason}: ${delta >= 0 ? 'crédito' : 'débito'} de ${formatCurrency(Math.abs(delta))} em "${banco.banco}" (${banco.unidade})`
    );
  };

  const balanceDeltaForLancamento = (lancamento: Pick<Lancamento, 'tipo' | 'valor'>) =>
    lancamento.tipo === 'RECEITA' ? lancamento.valor : -lancamento.valor;

  const ensurePaidLancamentoHasBanco = (
    lancamento: Pick<Lancamento, 'bancoId' | 'contaBancaria' | 'unidade' | 'status'>
  ) => {
    if (lancamento.status !== 'PAGO') return true;
    if (resolveBancoForLancamento(lancamento)?.ativo) return true;
    showToast(
      `Selecione uma conta bancária ativa da unidade "${lancamento.unidade}" antes de registrar o pagamento.`,
      'error'
    );
    return false;
  };

  // --- Master CRUDs ---
  const addUnit = (u: Omit<UnitConfig, 'id'>) => {
    if (!checkAdminPermission('Cadastrar Filial')) return;
    const newU: UnitConfig = { ...u, id: 'u-' + Date.now() };
    setUnits((prev) => [...prev, newU]);
    showToast(`Filial "${u.nome}" cadastrada com sucesso!`, 'success');
    addAuditLog('Configurações', 'CRIACAO', `Cadastrou nova filial "${u.nome}"`);
  };

  const updateUnit = (id: string, u: Partial<UnitConfig>) => {
    if (!checkAdminPermission('Editar Filial')) return;
    setUnits((prev) => prev.map((item) => (item.id === id ? { ...item, ...u } : item)));
    showToast('Dados da filial atualizados!', 'info');
    addAuditLog('Configurações', 'EDICAO', `Atualizou filial ID ${id}`);
  };

  const toggleUnitActive = (id: string) => {
    if (!checkAdminPermission('Alterar Status de Filial')) return;
    setUnits((prev) => prev.map((item) => (item.id === id ? { ...item, ativa: !item.ativa } : item)));
    showToast('Status da filial alterado.', 'info');
  };

  const deleteUnit = (id: string) => {
    if (!checkAdminPermission('Excluir Filial')) return;
    setUnits((prev) => prev.filter((item) => item.id !== id));
    showToast('Filial removida.', 'info');
  };

  // Categorias CRUD
  const addCategoria = (c: Omit<CategoriaMaster, 'id'>) => {
    if (!checkAdminPermission('Cadastrar Categoria')) return;
    const newC: CategoriaMaster = { ...c, id: 'cat-' + Date.now() };
    setCategorias((prev) => [...prev, newC]);
    showToast(`Categoria "${c.nome}" adicionada!`, 'success');
  };
  const updateCategoria = (id: string, c: Partial<CategoriaMaster>) => {
    if (!checkAdminPermission('Editar Categoria')) return;
    setCategorias((prev) => prev.map((item) => (item.id === id ? { ...item, ...c } : item)));
    showToast('Categoria atualizada!', 'info');
  };
  const toggleCategoriaActive = (id: string) => {
    if (!checkAdminPermission('Alterar Status de Categoria')) return;
    setCategorias((prev) => prev.map((item) => (item.id === id ? { ...item, ativa: !item.ativa } : item)));
  };
  const deleteCategoria = (id: string) => {
    if (!checkAdminPermission('Excluir Categoria')) return;
    setCategorias((prev) => prev.filter((item) => item.id !== id));
    showToast('Categoria removida.', 'info');
  };

  // Centros de Custo CRUD
  const addCentroCusto = (cc: Omit<CentroCustoMaster, 'id'>) => {
    if (!checkAdminPermission('Cadastrar Centro de Custo')) return;
    const newCC: CentroCustoMaster = { ...cc, id: 'cc-' + Date.now() };
    setCentrosCusto((prev) => [...prev, newCC]);
    showToast(`Centro de custo "${cc.nome}" adicionado!`, 'success');
  };
  const updateCentroCusto = (id: string, cc: Partial<CentroCustoMaster>) => {
    if (!checkAdminPermission('Editar Centro de Custo')) return;
    setCentrosCusto((prev) => prev.map((item) => (item.id === id ? { ...item, ...cc } : item)));
  };
  const toggleCentroCustoActive = (id: string) => {
    if (!checkAdminPermission('Alterar Status de Centro de Custo')) return;
    setCentrosCusto((prev) => prev.map((item) => (item.id === id ? { ...item, ativo: !item.ativo } : item)));
  };
  const deleteCentroCusto = (id: string) => {
    if (!checkAdminPermission('Excluir Centro de Custo')) return;
    setCentrosCusto((prev) => prev.filter((item) => item.id !== id));
    showToast('Centro de custo removido.', 'info');
  };

  // Fornecedores CRUD
  const addFornecedor = (f: Omit<FornecedorMaster, 'id'>) => {
    if (!checkAdminPermission('Cadastrar Fornecedor')) return;
    const newF: FornecedorMaster = { ...f, id: 'forn-' + Date.now() };
    setFornecedores((prev) => [...prev, newF]);
    showToast(`Cadastro de "${f.nome}" realizado!`, 'success');
  };
  const updateFornecedor = (id: string, f: Partial<FornecedorMaster>) => {
    if (!checkAdminPermission('Editar Fornecedor')) return;
    setFornecedores((prev) => prev.map((item) => (item.id === id ? { ...item, ...f } : item)));
  };
  const toggleFornecedorActive = (id: string) => {
    if (!checkAdminPermission('Alterar Status de Fornecedor')) return;
    setFornecedores((prev) => prev.map((item) => (item.id === id ? { ...item, ativo: !item.ativo } : item)));
  };
  const deleteFornecedor = (id: string) => {
    if (!checkAdminPermission('Excluir Fornecedor')) return;
    setFornecedores((prev) => prev.filter((item) => item.id !== id));
    showToast('Cadastro removido.', 'info');
  };

  // Bancos CRUD
  const addBanco = (b: Omit<BancoMaster, 'id'>) => {
    if (!checkAdminPermission('Cadastrar Conta Bancária')) return;
    const newB: BancoMaster = { ...b, id: 'banc-' + Date.now() };
    setBancos((prev) => [...prev, newB]);
    showToast(`Conta bancária "${b.banco}" cadastrada!`, 'success');
    addAuditLog(
      'Contas Bancárias',
      'CRIACAO',
      `Cadastrou a conta "${b.banco}" para ${b.unidade} com saldo inicial de ${formatCurrency(b.saldo)}`
    );
  };
  const updateBanco = (id: string, b: Partial<BancoMaster>) => {
    if (!checkAdminPermission('Editar Conta Bancária')) return;
    const existing = bancos.find((item) => item.id === id);
    if (!existing) return;
    const updated = { ...existing, ...b };
    setBancos((prev) => prev.map((item) => (item.id === id ? { ...item, ...b } : item)));
    showToast('Conta bancária atualizada!', 'success');
    addAuditLog(
      'Contas Bancárias',
      'EDICAO',
      `Atualizou manualmente a conta "${existing.banco}"`,
      `${existing.unidade} • saldo ${formatCurrency(existing.saldo)}`,
      `${updated.unidade} • saldo ${formatCurrency(updated.saldo)}`
    );
  };
  const toggleBancoActive = (id: string) => {
    if (!checkAdminPermission('Alterar Status de Conta Bancária')) return;
    setBancos((prev) => prev.map((item) => (item.id === id ? { ...item, ativo: !item.ativo } : item)));
  };
  const deleteBanco = (id: string) => {
    if (!checkAdminPermission('Excluir Conta Bancária')) return;
    setBancos((prev) => prev.filter((item) => item.id !== id));
    showToast('Conta bancária removida.', 'info');
  };

  // Condições de Pagamento / DDL CRUD
  const addCondicaoPagamento = (c: Omit<CondicaoPagamento, 'id'>) => {
    if (!checkAdminPermission('Cadastrar DDL')) return;
    const newC: CondicaoPagamento = { ...c, id: 'cond-' + Date.now() };
    setCondicoesPagamento((prev) => [...prev, newC]);
    showToast(`Condição de pagamento "${c.nome}" cadastrada!`, 'success');
  };
  const updateCondicaoPagamento = (id: string, c: Partial<CondicaoPagamento>) => {
    if (!checkAdminPermission('Editar DDL')) return;
    setCondicoesPagamento((prev) => prev.map((item) => (item.id === id ? { ...item, ...c } : item)));
  };
  const toggleCondicaoPagamentoActive = (id: string) => {
    if (!checkAdminPermission('Alterar Status de DDL')) return;
    setCondicoesPagamento((prev) => prev.map((item) => (item.id === id ? { ...item, ativa: !item.ativa } : item)));
  };
  const deleteCondicaoPagamento = (id: string) => {
    if (!checkAdminPermission('Excluir DDL')) return;
    setCondicoesPagamento((prev) => prev.filter((item) => item.id !== id));
    showToast('Condição de pagamento removida.', 'info');
  };

  // --- Lancamentos CRUD & DDL / Parcelamento Automático ---
  const addLancamentoComDDL = (
    dadosBase: Omit<Lancamento, 'id' | 'criadoEm'>,
    dataEmissao: string,
    prazosDias: number[],
    primeiroVencimento?: string
  ) => {
    if (!checkFinancialPermission('Lançamento DDL')) return;
    dadosBase = bindLancamentoToBanco({
      ...dadosBase,
      dataCompetencia: dadosBase.dataCompetencia || dataEmissao || dadosBase.dataVencimento,
      impactoDRE: dadosBase.impactoDRE || dadosBase.tipo,
      unidade: resolveAllowedUnit(dadosBase.unidade)
    });
    if (!ensurePaidLancamentoHasBanco(dadosBase)) return;
    if (!prazosDias || prazosDias.length === 0) {
      prazosDias = [0];
    }

    const totalParcelas = prazosDias.length;
    const valorUnitario = Math.round((dadosBase.valor / totalParcelas) * 100) / 100;
    const parcelamentoId = totalParcelas > 1 ? 'parc-' + Date.now() : undefined;
    const vencimentos = calculateDueDateSchedule(dataEmissao, prazosDias, primeiroVencimento);

    const novosLancamentos: Lancamento[] = [];
    const cronogramaItems: any[] = [];

    prazosDias.forEach((dias, index) => {
      const vencimentoStr = vencimentos[index];

      const lancId = 'lanc-' + Date.now() + '-' + index;
      const statusLanc: StatusLancamento = dadosBase.status === 'PAGO'
        ? 'PAGO'
        : dadosBase.status === 'CANCELADO'
          ? 'CANCELADO'
          : dadosBase.status === 'ATRASADO'
            ? 'ATRASADO'
            : 'PENDENTE';

      const descFinal = totalParcelas > 1
        ? `${dadosBase.descricao} (${index + 1}/${totalParcelas} - ${dias} DDL)`
        : dadosBase.descricao;

      const newLanc: Lancamento = {
        ...dadosBase,
        id: lancId,
        descricao: descFinal,
        valor: valorUnitario,
        dataVencimento: vencimentoStr,
        status: statusLanc,
        dataPagamento: statusLanc === 'PAGO'
          ? dadosBase.dataPagamento || vencimentoStr
          : undefined,
        numeroParcela: totalParcelas > 1 ? `${index + 1}/${totalParcelas}` : undefined,
        parcelamentoId,
        criadoEm: new Date().toISOString()
      };

      novosLancamentos.push(newLanc);

      if (totalParcelas > 1) {
        cronogramaItems.push({
          numero: index + 1,
          vencimento: vencimentoStr,
          valor: valorUnitario,
          status: statusLanc,
          dataPagamento: statusLanc === 'PAGO'
            ? dadosBase.dataPagamento || vencimentoStr
            : undefined,
          lancamentoId: lancId
        });
      }
    });

    setLancamentos((prev) => [...novosLancamentos, ...prev]);

    const paidBalanceDelta = novosLancamentos
      .filter((item) => item.status === 'PAGO')
      .reduce((total, item) => total + balanceDeltaForLancamento(item), 0);
    if (paidBalanceDelta !== 0 && dadosBase.bancoId) {
      adjustBancoBalance(dadosBase.bancoId, paidBalanceDelta, `Lançamento "${dadosBase.descricao}"`);
    }

    if (totalParcelas > 1 && parcelamentoId) {
      const newParcelamento: Parcelamento = {
        id: parcelamentoId,
        unidade: dadosBase.unidade,
        bancoId: dadosBase.bancoId,
        contaBancaria: dadosBase.contaBancaria,
        titulo: dadosBase.descricao,
        fornecedor: dadosBase.fornecedorCliente,
        categoria: dadosBase.categoria,
        centroCusto: dadosBase.centroCusto,
        valorTotal: dadosBase.valor,
        numeroParcelas: totalParcelas,
        parcelasPagas: cronogramaItems.filter((item) => item.status === 'PAGO').length,
        valorParcela: valorUnitario,
        dataInicio: dataEmissao || new Date().toISOString().substring(0, 10),
        status: cronogramaItems.every((item) => item.status === 'PAGO') ? 'CONCLUIDO' : 'EM_ANDAMENTO',
        cronograma: cronogramaItems
      };
      setParcelamentos((prev) => [newParcelamento, ...prev]);
    }

    addAuditLog(
      'Lancamentos',
      'CRIACAO',
      `Lançamento criado com DDL (${prazosDias.join('/')} dias) gerando ${totalParcelas} boleto(s)`
    );

    showToast(
      totalParcelas > 1
        ? `${totalParcelas} boletos com vencimento DDL (${prazosDias.join('/')} dias) cadastrados!`
        : 'Lançamento cadastrado com sucesso!',
      'success'
    );
  };
  const addLancamentoComParcelamento = (
    baseData: Omit<Lancamento, 'id' | 'criadoEm'>,
    numeroParcelas: number
  ) => {
    if (!checkFinancialPermission('Lançamento Parcelado')) return;
    baseData = bindLancamentoToBanco({
      ...baseData,
      unidade: resolveAllowedUnit(baseData.unidade)
    });
    if (!ensurePaidLancamentoHasBanco(baseData)) return;
    if (numeroParcelas <= 1) {
      addLancamento(baseData);
      return;
    }

    const valorTotal = baseData.valor;
    const valorParcela = Math.round((valorTotal / numeroParcelas) * 100) / 100;
    const parcelamentoId = 'parc-' + Date.now();
    const dataInicio = baseData.dataVencimento;

    const cronograma: Parcelamento['cronograma'] = [];
    const novosLancamentos: Lancamento[] = [];

    for (let i = 1; i <= numeroParcelas; i++) {
      const dt = new Date(dataInicio + 'T00:00:00');
      dt.setMonth(dt.getMonth() + (i - 1));
      const vencimentoStr = dt.toISOString().substring(0, 10);
      const lancId = `lanc-${parcelamentoId}-${i}`;

      const isPaid = i === 1 && baseData.status === 'PAGO';

      cronograma.push({
        numero: i,
        vencimento: vencimentoStr,
        valor: valorParcela,
        status: isPaid ? 'PAGO' : 'PENDENTE',
        dataPagamento: isPaid ? baseData.dataPagamento || dataInicio : undefined,
        lancamentoId: lancId
      });

      novosLancamentos.push({
        ...baseData,
        id: lancId,
        descricao: `${baseData.descricao} (${i}/${numeroParcelas})`,
        valor: valorParcela,
        dataVencimento: vencimentoStr,
        parcelamentoId,
        numeroParcela: `${i}/${numeroParcelas}`,
        status: isPaid ? 'PAGO' : 'PENDENTE',
        dataPagamento: isPaid ? baseData.dataPagamento || dataInicio : undefined,
        criadoEm: new Date().toISOString().substring(0, 10)
      });
    }

    const novoParcelamento: Parcelamento = {
      id: parcelamentoId,
      unidade: baseData.unidade,
      bancoId: baseData.bancoId,
      contaBancaria: baseData.contaBancaria,
      titulo: baseData.descricao,
      fornecedor: baseData.fornecedorCliente,
      categoria: baseData.categoria,
      centroCusto: baseData.centroCusto,
      valorTotal,
      numeroParcelas,
      parcelasPagas: baseData.status === 'PAGO' ? 1 : 0,
      valorParcela,
      dataInicio,
      status: 'EM_ANDAMENTO',
      cronograma
    };

    setParcelamentos((prev) => [novoParcelamento, ...prev]);
    setLancamentos((prev) => [...novosLancamentos, ...prev]);
    const paidLancamento = novosLancamentos.find((item) => item.status === 'PAGO');
    if (paidLancamento?.bancoId) {
      adjustBancoBalance(
        paidLancamento.bancoId,
        balanceDeltaForLancamento(paidLancamento),
        `Primeira parcela de "${baseData.descricao}"`
      );
    }

    showToast(
      `Gerado parcelamento em ${numeroParcelas}x de R$ ${valorParcela.toFixed(2)} e lançado no financeiro!`,
      'success'
    );
    addAuditLog('Parcelamentos', 'CRIACAO', `Iniciado parcelamento "${baseData.descricao}" (${numeroParcelas}x)`);
  };

  const addTransferencia = (dados: {
    origemBancoId: string;
    destinoBancoId: string;
    valor: number;
    data: string;
    descricao: string;
    unidade: string;
    comprovanteUrl?: string;
    documentoRef?: string;
  }) => {
    if (!checkFinancialPermission('Transferência de Contas')) return;
    dados = { ...dados, unidade: resolveAllowedUnit(dados.unidade) };
    const origem = bancos.find((banco) => banco.id === dados.origemBancoId);
    const destino = bancos.find((banco) => banco.id === dados.destinoBancoId);
    if (!origem || !destino) {
      showToast('Selecione as contas de origem e destino da transferência.', 'error');
      return;
    }
    if (origem.id === destino.id) {
      showToast('A conta de destino deve ser diferente da conta de origem.', 'error');
      return;
    }
    if (!Number.isFinite(dados.valor) || dados.valor <= 0) {
      showToast('Informe um valor de transferência maior que zero.', 'error');
      return;
    }
    if (origem.saldo < dados.valor) {
      showToast(`Saldo insuficiente em "${origem.banco}" para concluir a transferência.`, 'error');
      return;
    }
    if (origem.unidade !== dados.unidade || destino.unidade !== dados.unidade) {
      showToast('A transferência só pode ocorrer entre contas da unidade selecionada.', 'error');
      return;
    }

    setBancos((prev) =>
      prev.map((banco) => {
        if (banco.id === origem.id) return { ...banco, saldo: banco.saldo - dados.valor };
        if (banco.id === destino.id) return { ...banco, saldo: banco.saldo + dados.valor };
        return banco;
      })
    );

    if (origem.banco.toLowerCase().includes('caixa')) {
      registrarMovimentacaoCaixa(
        'SANGRIA',
        `Transferência para ${destino.banco}: ${dados.descricao}`,
        dados.valor,
        dados.documentoRef,
        {
          finalidade: 'DEPOSITO_BANCARIO',
          impactoDRE: 'NAO_AFETA',
          statusConciliacao: 'EM_TRANSITO',
          bancoOrigemId: origem.id,
          bancoDestinoId: destino.id,
          observacoes: dados.descricao
        },
        true,
        dados.unidade
      );
    } else if (destino.banco.toLowerCase().includes('caixa')) {
      registrarMovimentacaoCaixa(
        'SUPRIMENTO',
        `Transferência de ${origem.banco}: ${dados.descricao}`,
        dados.valor,
        dados.documentoRef,
        {
          finalidade: 'REFORCO_TROCO',
          impactoDRE: 'NAO_AFETA',
          statusConciliacao: 'CONCILIADO',
          bancoOrigemId: origem.id,
          bancoDestinoId: destino.id,
          observacoes: dados.descricao
        },
        true,
        dados.unidade
      );
    }

    addAuditLog(
      'Transferência de Contas',
      'CRIACAO',
      `Transferência de R$ ${dados.valor.toFixed(2)} de [${origem.banco}] para [${destino.banco}] (${dados.unidade})${dados.documentoRef ? ` — anexo: ${dados.documentoRef}` : ''}`
    );

    showToast(
      `Transferência de R$ ${dados.valor.toFixed(2)} registrada com sucesso entre contas.`,
      'success'
    );
  };

  const exportBackupJSON = () => {
    if (!checkAdminPermission('Exportar Backup Completo')) return '';
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        units,
        categorias,
        centrosCusto,
        fornecedores,
        bancos,
        lancamentos,
        parcelamentos,
        documentosOCR,
        sessaoCaixa,
        fechamentoMensal,
        auditLogs
      },
      null,
      2
    );
  };

  // --- Lancamentos CRUD ---
  const addLancamento = (l: Omit<Lancamento, 'id' | 'criadoEm'>) => {
    if (!checkFinancialPermission('Criar Lançamento')) return;
    l = bindLancamentoToBanco({
      ...l,
      dataCompetencia: l.dataCompetencia || l.dataVencimento,
      impactoDRE: l.impactoDRE || l.tipo,
      unidade: resolveAllowedUnit(l.unidade)
    });
    if (!ensurePaidLancamentoHasBanco(l)) return;
    const id = (l.tipo === 'RECEITA' ? 'rec-' : 'desp-') + Date.now().toString().slice(-4);
    const newL: Lancamento = {
      ...l,
      id,
      criadoEm: new Date().toISOString().substring(0, 10)
    };
    setLancamentos((prev) => [newL, ...prev]);
    if (newL.status === 'PAGO' && newL.bancoId) {
      adjustBancoBalance(newL.bancoId, balanceDeltaForLancamento(newL), `Lançamento "${newL.descricao}"`);
    }
    showToast(`${l.tipo === 'RECEITA' ? 'Receita' : 'Despesa'} lançada com sucesso!`, 'success');
    addAuditLog('Lançamentos', 'CRIACAO', `Criou ${l.tipo.toLowerCase()} "${l.descricao}" no valor de R$ ${l.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, undefined, `Status: ${l.status}`);
  };

  const updateLancamento = (id: string, l: Partial<Lancamento>) => {
    if (!checkFinancialPermission('Editar Lançamento')) return;
    const existing = lancamentos.find((item) => item.id === id);
    if (!existing) return;
    if (existing && !canManageUnit(existing.unidade, 'Editar Lançamento')) return;
    if (isFinance && currentUser) l = { ...l, unidade: currentUser.unit };
    const updated = bindLancamentoToBanco({ ...existing, ...l });
    if (!ensurePaidLancamentoHasBanco(updated)) return;
    if (existing.status === 'PAGO') {
      const oldBank = resolveBancoForLancamento(existing);
      if (!oldBank) {
        showToast('Não foi possível estornar o saldo da conta anterior. Vincule uma conta válida.', 'error');
        return;
      }
      adjustBancoBalance(oldBank.id, -balanceDeltaForLancamento(existing), `Estorno da edição de "${existing.descricao}"`);
    }
    if (updated.status === 'PAGO' && updated.bancoId) {
      adjustBancoBalance(updated.bancoId, balanceDeltaForLancamento(updated), `Edição de "${updated.descricao}"`);
    }
    setLancamentos((prev) => prev.map((item) => (item.id === id ? updated : item)));
    showToast('Lançamento atualizado!', 'info');
    addAuditLog('Lançamentos', 'EDICAO', `Atualizou lançamento ID ${id}`);
  };

  const deleteLancamento = (id: string) => {
    if (!checkFinancialPermission('Excluir Lançamento')) return;
    const existing = lancamentos.find((item) => item.id === id);
    if (!existing) return;
    if (existing && !canManageUnit(existing.unidade, 'Excluir Lançamento')) return;
    if (existing.status === 'PAGO') {
      const banco = resolveBancoForLancamento(existing);
      if (!banco) {
        showToast('Não foi possível estornar o saldo: o lançamento não possui uma conta válida.', 'error');
        return;
      }
      adjustBancoBalance(banco.id, -balanceDeltaForLancamento(existing), `Exclusão de "${existing.descricao}"`);
    }
    setLancamentos((prev) => prev.filter((item) => item.id !== id));
    showToast('Lançamento removido.', 'info');
    addAuditLog('Lançamentos', 'EXCLUSAO', `Excluiu lançamento ID ${id}`);
  };

  const marcarLancamentoComoPago = (id: string) => {
    if (!checkFinancialPermission('Liquidar Lançamento')) return;
    const existing = lancamentos.find((item) => item.id === id);
    if (!existing) return;
    if (existing && !canManageUnit(existing.unidade, 'Liquidar Lançamento')) return;
    if (existing.status === 'PAGO') {
      showToast('Este lançamento já está pago.', 'info');
      return;
    }
    const paidLancamento = bindLancamentoToBanco({
      ...existing,
      status: 'PAGO' as const,
      dataPagamento: new Date().toISOString().substring(0, 10)
    });
    if (!ensurePaidLancamentoHasBanco(paidLancamento)) return;
    setLancamentos((prev) =>
      prev.map((item) => (item.id === id ? paidLancamento : item))
    );
    if (paidLancamento.bancoId) {
      adjustBancoBalance(
        paidLancamento.bancoId,
        balanceDeltaForLancamento(paidLancamento),
        `Liquidação de "${paidLancamento.descricao}"`
      );
    }
    showToast('Lançamento marcado como PAGO!', 'success');
    addAuditLog('Lançamentos', 'EDICAO', `Liquidou lançamento ID ${id}`, 'Status: PENDENTE', 'Status: PAGO');
  };

  // --- Parcelamentos ---
  const addParcelamento = (p: Omit<Parcelamento, 'id' | 'parcelasPagas' | 'status' | 'cronograma'>) => {
    if (!checkFinancialPermission('Criar Parcelamento')) return;
    const id = 'parc-' + Date.now().toString().slice(-4);
    const valorParcela = p.valorTotal / p.numeroParcelas;
    const cronograma = Array.from({ length: p.numeroParcelas }).map((_, idx) => {
      const dt = new Date(p.dataInicio);
      dt.setMonth(dt.getMonth() + idx);
      return {
        numero: idx + 1,
        vencimento: dt.toISOString().substring(0, 10),
        valor: valorParcela,
        status: 'PENDENTE' as const
      };
    });

    const unidade = resolveAllowedUnit(p.unidade);
    const banco = resolveBancoForLancamento({
      bancoId: p.bancoId,
      contaBancaria: p.contaBancaria || '',
      unidade
    });
    if (!banco) {
      showToast(`Selecione uma conta bancária ativa da unidade "${unidade}".`, 'error');
      return;
    }

    const newP: Parcelamento = {
      ...p,
      id,
      unidade,
      bancoId: banco.id,
      contaBancaria: banco.banco,
      parcelasPagas: 0,
      valorParcela,
      status: 'EM_ANDAMENTO',
      cronograma
    };

    setParcelamentos((prev) => [newP, ...prev]);
    showToast(`Contrato de parcelamento gerado com ${p.numeroParcelas} parcelas!`, 'success');
    addAuditLog('Parcelamentos', 'CRIACAO', `Criou parcelamento "${p.titulo}" no valor total de R$ ${p.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  };

  const pagarParcela = (parcelamentoId: string, numeroParcela: number) => {
    if (!checkFinancialPermission('Pagar Parcela')) return;
    const parcelamento = parcelamentos.find((item) => item.id === parcelamentoId);
    if (!parcelamento) return;
    if (parcelamento && !canManageUnit(parcelamento.unidade, 'Pagar Parcela')) return;
    const parcela = parcelamento.cronograma.find((item) => item.numero === numeroParcela);
    if (!parcela || parcela.status === 'PAGO') {
      showToast('Esta parcela já está paga ou não foi localizada.', 'info');
      return;
    }
    const linkedLancamento = parcela.lancamentoId
      ? lancamentos.find((item) => item.id === parcela.lancamentoId)
      : undefined;
    const banco = linkedLancamento
      ? resolveBancoForLancamento(linkedLancamento)
      : resolveBancoForLancamento({
          bancoId: parcelamento.bancoId,
          contaBancaria: parcelamento.contaBancaria || '',
          unidade: parcelamento.unidade
        });
    if (!banco) {
      showToast(
        `Cadastre ou vincule uma conta bancária para ${parcelamento.unidade} antes de pagar a parcela.`,
        'error'
      );
      return;
    }

    if (linkedLancamento) {
      marcarLancamentoComoPago(linkedLancamento.id);
    } else {
      addLancamento({
        descricao: `Parcela ${numeroParcela}/${parcelamento.numeroParcelas} - ${parcelamento.titulo}`,
        tipo: 'DESPESA',
        categoria: parcelamento.categoria,
        centroCusto: parcelamento.centroCusto,
        valor: parcela.valor,
        dataVencimento: parcela.vencimento,
        dataPagamento: new Date().toISOString().substring(0, 10),
        status: 'PAGO',
        fornecedorCliente: parcelamento.fornecedor,
        bancoId: banco.id,
        contaBancaria: banco.banco,
        formaPagamento: 'BOLETO',
        unidade: parcelamento.unidade,
        parcelamentoId: parcelamento.id,
        numeroParcela: `${numeroParcela}/${parcelamento.numeroParcelas}`
      });
    }

    setParcelamentos((prev) =>
      prev.map((p) => {
        if (p.id !== parcelamentoId) return p;
        const updatedCronograma = p.cronograma.map((c) =>
          c.numero === numeroParcela
            ? { ...c, status: 'PAGO' as const, dataPagamento: new Date().toISOString().substring(0, 10) }
            : c
        );
        const pagasCount = updatedCronograma.filter((c) => c.status === 'PAGO').length;
        const status = pagasCount === p.numeroParcelas ? 'CONCLUIDO' : 'EM_ANDAMENTO';

        return {
          ...p,
          parcelasPagas: pagasCount,
          status,
          cronograma: updatedCronograma
        };
      })
    );
    showToast(`Parcela ${numeroParcela} paga com sucesso! Saldo bancário atualizado.`, 'success');
  };

  // --- OCR / Documentos ---
  const uploadDocumentoOCR = async (file: File) => {
    if (!checkFinancialPermission('Upload Documento OCR')) return;
    const docId = 'ocr-' + Date.now().toString().slice(-4);
    const normalizedFileName = file.name.toLowerCase();
    const isPdf = file.type === 'application/pdf' || normalizedFileName.endsWith('.pdf');
    const isImage = file.type.startsWith('image/') || /\.(png|jpe?g)$/.test(normalizedFileName);
    
    // Create preview URL
    let objectPreviewUrl = '';
    try {
      objectPreviewUrl = URL.createObjectURL(file);
    } catch (e) {
      console.warn('Could not create object URL for file', e);
    }

    const initialDoc: DocumentoOCR = {
      id: docId,
      nomeArquivo: file.name,
      tamanho: (file.size / 1024).toFixed(0) + ' KB',
      tipo: file.name.toLowerCase().includes('extrato')
        ? 'EXTRATO'
        : file.name.toLowerCase().includes('comprovante') || file.name.toLowerCase().includes('pix')
        ? 'COMPROVANTE'
        : file.name.toLowerCase().includes('recibo')
        ? 'RECIBO'
        : file.name.toLowerCase().includes('boleto')
        ? 'BOLETO'
        : 'NFE',
      status: 'PROCESSANDO',
      confiancaOCR: 0,
      dataUpload: new Date().toISOString().replace('T', ' ').substring(0, 19),
      dadosExtraidos: {
        fornecedor: 'Processando OCR...',
        cnpj: '...',
        dataEmissao: new Date().toISOString().substring(0, 10),
        dataVencimento: new Date(Date.now() + 864000000).toISOString().substring(0, 10),
        valorTotal: 0,
        categoria: 'Insumos Médicos & Estéticos',
        centroCusto: 'Estoque Central'
      },
      previewUrl: objectPreviewUrl,
      previewMimeType: isPdf ? 'application/pdf' : isImage ? file.type || 'image/jpeg' : file.type
    };

    setDocumentosOCR((prev) => [initialDoc, ...prev]);
    setSelectedDocumentForReviewId(docId);
    showToast(`Analisando arquivo "${file.name}" via Motor OCR Inteligente...`, 'info');
    addAuditLog('Documentos OCR', 'CRIACAO', `Upload de arquivo "${file.name}" para OCR`);

    try {
      // Read file content
      const base64Data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string) || '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      });

      let textContent = '';
      if (file.type.includes('text') || file.name.endsWith('.xml') || file.name.endsWith('.txt')) {
        textContent = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string) || '');
          reader.onerror = () => resolve('');
          reader.readAsText(file);
        });
      }

      // Call server endpoint
      const response = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: base64Data,
          mimeType: file.type || 'image/png',
          fileName: file.name,
          textContent
        })
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.detail || `Falha no OCR (HTTP ${response.status})`);
      }

      if (result.success && result.dadosExtraidos) {
        const normalizeExtractedData = (extraidos: any): DocumentoOCR['dadosExtraidos'] => ({
          fornecedor: (
            extraidos.sentidoSugerido === 'ENTRADA'
              ? extraidos.pagador
              : extraidos.sentidoSugerido === 'SAIDA'
                ? extraidos.recebedor
                : ''
          ) || extraidos.fornecedor || extraidos.recebedor || extraidos.pagador || 'Contraparte Não Identificada',
          cnpj: extraidos.cnpj || '',
          dataEmissao: extraidos.dataEmissao || '',
          dataCompetencia: extraidos.dataCompetencia || extraidos.dataEmissao || extraidos.dataVencimento || '',
          dataVencimento: extraidos.dataVencimento || extraidos.dataEmissao || '',
          valorTotal: typeof extraidos.valorTotal === 'number' ? extraidos.valorTotal : 0,
          categoria: extraidos.categoria || 'Outras Despesas Operacionais',
          centroCusto: extraidos.centroCusto || 'Administrativo',
          observacoes: extraidos.observacoes || '',
          pagador: extraidos.pagador || '',
          recebedor: extraidos.recebedor || '',
          documentoNumero: extraidos.documentoNumero || '',
          linhaDigitavel: extraidos.linhaDigitavel || '',
          chaveDocumento: extraidos.chaveDocumento || '',
          identificadorTransacao: extraidos.identificadorTransacao || '',
          sentidoSugerido: extraidos.sentidoSugerido || 'A_CONFIRMAR',
          impactoDRESugerido: extraidos.impactoDRESugerido || 'A_CONFIRMAR',
          finalidadeSugerida: extraidos.finalidadeSugerida || 'A_CONFIRMAR',
          parcelaNumero: extraidos.parcelaNumero || '',
          paginaOrigem: extraidos.paginaOrigem,
          itens: extraidos.itens || []
        });
        const entityResults = Array.isArray(result.entidadesFinanceiras) && result.entidadesFinanceiras.length > 1
          ? result.entidadesFinanceiras
          : [{ tipo: result.tipo, dadosExtraidos: result.dadosExtraidos }];
        const totalEntities = entityResults.length;
        const extractedDocuments: DocumentoOCR[] = entityResults.map((entity: any, index: number) => ({
          ...initialDoc,
          id: totalEntities > 1 ? `${docId}-entidade-${index + 1}` : docId,
          tipo: entity.tipo || result.tipo || initialDoc.tipo,
          status: 'PENDENTE_REVISAO',
          confiancaOCR: result.confiancaOCR ?? 0,
          dadosExtraidos: normalizeExtractedData(entity.dadosExtraidos || entity),
          hashArquivo: result.metadados?.hashArquivo,
          entidadeNumero: totalEntities > 1 ? index + 1 : undefined,
          totalEntidadesDocumento: totalEntities > 1 ? totalEntities : undefined,
          documentoOrigemId: totalEntities > 1 ? docId : undefined
        }));

        setDocumentosOCR((prev) => prev.flatMap((doc) => doc.id === docId ? extractedDocuments : [doc]));
        setSelectedDocumentForReviewId(extractedDocuments[0].id);

        if (totalEntities > 1) {
          showToast(
            `OCR V2 concluiu a leitura e separou ${totalEntities} movimentações para confirmação individual.`,
            'success'
          );
        } else {
          const extraidos = extractedDocuments[0].dadosExtraidos;
          showToast(
            extraidos.valorTotal > 0
              ? `OCR V2 concluído: R$ ${extraidos.valorTotal.toFixed(2)} (${extraidos.fornecedor}).`
              : 'OCR V2 concluído. Confira os campos e a classificação financeira.',
            extraidos.valorTotal > 0 ? 'success' : 'info'
          );
        }
      } else {
        throw new Error('Retorno inválido do OCR');
      }
    } catch (err: any) {
      console.error('Erro na requisição de OCR:', err);
      const errorMessage = err instanceof Error ? err.message : 'Falha desconhecida no OCR';
      setDocumentosOCR((prev) =>
        prev.map((doc) =>
          doc.id === docId
            ? {
                ...doc,
                status: 'PENDENTE_REVISAO',
                confiancaOCR: 0,
                dadosExtraidos: {
                  fornecedor: '',
                  cnpj: '',
                  dataEmissao: '',
                  dataVencimento: '',
                  valorTotal: 0,
                  categoria: 'Outras Despesas Operacionais',
                  centroCusto: 'Administrativo',
                  observacoes: `OCR não concluído: ${errorMessage}`
                }
              }
            : doc
        )
      );
      showToast(`Não foi possível concluir o OCR: ${errorMessage}`, 'error');
    }
  };

  const aprovarDocumentoOCR = (docId: string, dadosFinal: DocumentoOCR['dadosExtraidos']) => {
    if (!checkFinancialPermission('Aprovar Documento OCR')) return;
    const doc = documentosOCR.find((d) => d.id === docId);
    if (!doc) return;

    // O lançamento financeiro é gerado pela revisão DDL, já com conta e cronograma selecionados.
    setDocumentosOCR((prev) =>
      prev.map((d) =>
        d.id === docId
          ? {
              ...d,
              status: 'APROVADO',
              dadosExtraidos: dadosFinal
            }
          : d
      )
    );

    showToast('Documento conferido e aprovado.', 'success');
    addAuditLog('Documentos OCR', 'APROVACAO', `Aprovou e conferiu documento OCR ${docId} (${doc.nomeArquivo})`, 'PENDENTE_REVISAO', 'APROVADO');
  };

  const conciliarDocumentoOCR = (
    docId: string,
    lancamentoId: string,
    dadosFinal: DocumentoOCR['dadosExtraidos'],
    bancoId: string,
    justificativa?: string
  ) => {
    if (!checkFinancialPermission('Conciliar Documento OCR')) return;
    const doc = documentosOCR.find((item) => item.id === docId);
    const lancamento = lancamentos.find((item) => item.id === lancamentoId);
    const banco = bancos.find((item) => item.id === bancoId);
    if (!doc || !lancamento || !banco) {
      showToast('Não foi possível localizar o documento, lançamento ou conta para conciliação.', 'error');
      return;
    }
    if (!canManageUnit(lancamento.unidade, 'Conciliar Documento OCR')) return;
    if (banco.unidade !== lancamento.unidade) {
      showToast('A conta da conciliação deve pertencer à mesma unidade do lançamento.', 'error');
      return;
    }

    const wasPaid = lancamento.status === 'PAGO';
    const dataPagamento = dadosFinal.dataEmissao || new Date().toISOString().substring(0, 10);
    const reconciled: Lancamento = {
      ...lancamento,
      status: 'PAGO',
      dataPagamento: lancamento.dataPagamento || dataPagamento,
      bancoId: wasPaid ? lancamento.bancoId : banco.id,
      contaBancaria: wasPaid ? lancamento.contaBancaria : banco.banco,
      comprovanteUrl: doc.previewUrl || lancamento.comprovanteUrl,
      documentoRef: doc.nomeArquivo,
      cpfCnpjContraparte: dadosFinal.cnpj || lancamento.cpfCnpjContraparte,
      linhaDigitavel: dadosFinal.linhaDigitavel || lancamento.linhaDigitavel,
      chaveDocumento: dadosFinal.chaveDocumento || lancamento.chaveDocumento,
      identificadorTransacao: dadosFinal.identificadorTransacao || lancamento.identificadorTransacao,
      documentoConciliadoId: doc.id,
      observacoes: [lancamento.observacoes, justificativa].filter(Boolean).join(' | ')
    };

    setLancamentos((prev) => prev.map((item) => item.id === lancamentoId ? reconciled : item));
    if (!wasPaid) {
      adjustBancoBalance(banco.id, balanceDeltaForLancamento(reconciled), `Conciliação OCR de "${reconciled.descricao}"`);
    }
    setDocumentosOCR((prev) => prev.map((item) =>
      item.id === docId
        ? { ...item, status: 'APROVADO', dadosExtraidos: dadosFinal, lancamentoGeradoId: lancamentoId }
        : item
    ));

    showToast(
      wasPaid
        ? 'Documento vinculado ao lançamento já liquidado, sem movimentar o saldo novamente.'
        : 'Correspondência confirmada: lançamento liquidado e comprovante vinculado.',
      'success'
    );
    addAuditLog(
      'Conciliação Financeira',
      'CONCILIACAO',
      `Vinculou documento OCR ${docId} ao lançamento ${lancamentoId}${justificativa ? ` — ${justificativa}` : ''}`
    );
  };

  const rejeitarDocumentoOCR = (docId: string) => {
    if (!checkFinancialPermission('Rejeitar Documento OCR')) return;
    setDocumentosOCR((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, status: 'REJEITADO' } : d))
    );
    showToast('Documento rejeitado.', 'info');
    addAuditLog('Documentos OCR', 'EDICAO', `Rejeitou documento OCR ${docId}`, 'PENDENTE_REVISAO', 'REJEITADO');
  };

  // --- Caixa Fisico (saldo continuo por unidade) ---
  const registrarMovimentacaoCaixa = (
    tipo: 'SUPRIMENTO' | 'SANGRIA' | 'VENDA' | 'DESPESA',
    descricao: string,
    valor: number,
    comprovanteRef?: string,
    detalhes?: DetalhesMovimentacaoCaixa,
    skipBankBalance = false,
    unidadeOverride?: string
  ) => {
    if (!checkFinancialPermission('Movimentação de Caixa')) return;
    if (!Number.isFinite(valor) || valor <= 0) {
      showToast('Informe um valor maior que zero para a movimentação de caixa.', 'error');
      return;
    }
    const unidadeSolicitada =
      unidadeOverride || detalhes?.unidade || (selectedUnit === 'Todas as Unidades' ? '' : selectedUnit);
    if (!unidadeSolicitada) {
      showToast('Selecione a unidade do caixa antes de registrar a movimentação.', 'error');
      return;
    }
    const unidade = resolveAllowedUnit(unidadeSolicitada);
    const caixaBanco = bancos.find(
      (banco) =>
        banco.unidade === unidade &&
        banco.ativo &&
        banco.banco.toLocaleLowerCase('pt-BR').includes('caixa')
    );
    if (!caixaBanco && !skipBankBalance) {
      showToast(`Cadastre uma conta do tipo Caixa Físico para a unidade "${unidade}".`, 'error');
      return;
    }
    const isEntrada = tipo === 'SUPRIMENTO' || tipo === 'VENDA';
    const saldoAtual = caixaBanco?.saldo || 0;
    if (!isEntrada && saldoAtual < valor) {
      showToast(
        `Saldo insuficiente no Caixa Físico de "${unidade}". Disponível: ${formatCurrency(saldoAtual)}.`,
        'error'
      );
      return;
    }
    if (tipo === 'SANGRIA' && detalhes?.finalidade === 'PAGAMENTO_DESPESA') {
      const related = lancamentos.find((item) => item.id === detalhes.lancamentoRelacionadoId);
      if (!related || related.status === 'PAGO' || related.status === 'CANCELADO') {
        showToast('Selecione uma despesa pendente válida para liquidar em dinheiro.', 'error');
        return;
      }
      if (Math.abs(related.valor - valor) > 0.01) {
        showToast('O valor da sangria deve ser igual ao valor da despesa selecionada.', 'error');
        return;
      }
    }
    const delta = isEntrada ? valor : -valor;
    const novaMov = {
      id: 'mov-' + Date.now(),
      tipo,
      descricao,
      valor,
      dataHora: new Date().toISOString().replace('T', ' ').substring(0, 19),
      usuario: currentUser ? currentUser.name : 'Operador',
      unidade,
      sentido: isEntrada ? 'ENTRADA' as const : 'SAIDA' as const,
      saldoApos: saldoAtual + delta,
      comprovanteRef,
      finalidade: detalhes?.finalidade || (tipo === 'VENDA' ? 'VENDA_DINHEIRO' : tipo === 'SUPRIMENTO' ? 'REFORCO_TROCO' : 'OUTRO'),
      impactoDRE: detalhes?.impactoDRE || (tipo === 'VENDA' ? 'RECEITA' : 'NAO_AFETA'),
      statusConciliacao: detalhes?.statusConciliacao || 'CONCILIADO',
      bancoOrigemId: detalhes?.bancoOrigemId,
      bancoDestinoId: detalhes?.bancoDestinoId,
      lancamentoRelacionadoId: detalhes?.lancamentoRelacionadoId,
      observacoes: detalhes?.observacoes
    };

    setSessaoCaixa((prev) => ({
      ...prev,
      movimentacoes: [novaMov, ...prev.movimentacoes]
    }));

    if (tipo === 'VENDA') {
      addLancamento({
        descricao: `[Caixa Físico] ${descricao}`,
        tipo: 'RECEITA',
        categoria: 'Venda de Produtos',
        centroCusto: 'Recepção / Dermocosméticos',
        valor,
        dataVencimento: new Date().toISOString().substring(0, 10),
        dataPagamento: new Date().toISOString().substring(0, 10),
        status: 'PAGO',
        fornecedorCliente: 'Cliente Balcão',
        bancoId: caixaBanco?.id,
        contaBancaria: caixaBanco?.banco || 'Caixa Físico Recepção',
        formaPagamento: 'DINHEIRO',
        unidade
      });
    } else if (tipo === 'SANGRIA' && detalhes?.finalidade === 'PAGAMENTO_DESPESA' && detalhes.lancamentoRelacionadoId) {
      const related = lancamentos.find((item) => item.id === detalhes.lancamentoRelacionadoId);
      if (related && related.status !== 'PAGO') {
        setLancamentos((prev) => prev.map((item) =>
          item.id === related.id
            ? {
                ...item,
                status: 'PAGO',
                dataPagamento: new Date().toISOString().substring(0, 10),
                bancoId: caixaBanco?.id,
                contaBancaria: caixaBanco?.banco || 'Caixa Físico Recepção',
                formaPagamento: 'DINHEIRO',
                comprovanteUrl: comprovanteRef || item.comprovanteUrl
              }
            : item
        ));
      }
      if (!skipBankBalance && caixaBanco) {
        adjustBancoBalance(caixaBanco.id, -valor, `Pagamento em dinheiro: "${descricao}"`);
      }
    } else if (!skipBankBalance && caixaBanco) {
      adjustBancoBalance(caixaBanco.id, delta, `${tipo} no caixa físico: "${descricao}"`);
    }

    showToast(`Movimentação de ${tipo} de ${formatCurrency(valor)} registrada no Caixa Físico!`, 'success');
    addAuditLog(
      'Caixa Físico',
      'CRIACAO',
      `Registrou ${tipo} "${descricao}" de R$ ${valor.toFixed(2)} — finalidade ${novaMov.finalidade}`
    );
  };

  const ajustarSaldoCaixa = (dados: {
    unidade: string;
    novoSaldo: number;
    motivo: string;
    comprovanteRef?: string;
  }) => {
    if (!checkAdminPermission('Ajustar saldo do Caixa Físico')) return;
    const unidade = resolveAllowedUnit(dados.unidade);
    const motivo = dados.motivo.trim();
    if (!Number.isFinite(dados.novoSaldo) || dados.novoSaldo < 0) {
      showToast('O novo saldo do Caixa Físico deve ser zero ou maior.', 'error');
      return;
    }
    if (!motivo) {
      showToast('Informe o motivo do ajuste manual de saldo.', 'error');
      return;
    }
    const caixaBanco = bancos.find(
      (banco) =>
        banco.unidade === unidade &&
        banco.ativo &&
        banco.banco.toLocaleLowerCase('pt-BR').includes('caixa')
    );
    if (!caixaBanco) {
      showToast(`Cadastre uma conta do tipo Caixa Físico para a unidade "${unidade}".`, 'error');
      return;
    }

    const saldoAnterior = caixaBanco.saldo;
    const diferenca = dados.novoSaldo - saldoAnterior;
    if (Math.abs(diferenca) < 0.001) {
      showToast('O novo saldo é igual ao saldo atual; nenhum ajuste foi necessário.', 'info');
      return;
    }

    setBancos((prev) =>
      prev.map((banco) => (banco.id === caixaBanco.id ? { ...banco, saldo: dados.novoSaldo } : banco))
    );
    setSessaoCaixa((prev) => ({
      ...prev,
      movimentacoes: [
        {
          id: 'mov-' + Date.now(),
          tipo: 'AJUSTE',
          descricao: `Ajuste manual de saldo: ${motivo}`,
          valor: Math.abs(diferenca),
          dataHora: new Date().toISOString().replace('T', ' ').substring(0, 19),
          usuario: currentUser ? currentUser.name : 'Administrador',
          unidade,
          sentido: diferenca > 0 ? 'ENTRADA' : 'SAIDA',
          saldoApos: dados.novoSaldo,
          motivoAjuste: motivo,
          comprovanteRef: dados.comprovanteRef,
          finalidade: 'AJUSTE_SALDO',
          impactoDRE: 'NAO_AFETA',
          statusConciliacao: 'CONCILIADO'
        },
        ...prev.movimentacoes
      ]
    }));
    addAuditLog(
      'Caixa Físico',
      'EDICAO',
      `Ajustou manualmente o saldo do Caixa Físico de "${unidade}". Motivo: ${motivo}`,
      formatCurrency(saldoAnterior),
      formatCurrency(dados.novoSaldo)
    );
    showToast(`Saldo do Caixa Físico ajustado para ${formatCurrency(dados.novoSaldo)}.`, 'success');
  };

  // --- Fechamento Mensal ---
  const toggleChecklistItemFechamento = (chkId: string) => {
    if (!checkFinancialPermission('Alterar Checklist de Fechamento')) return;
    setFechamentoMensal((prev) => ({
      ...prev,
      checklist: prev.checklist.map((c) =>
        c.id === chkId ? { ...c, concluido: !c.concluido, responsavel: currentUser?.name } : c
      )
    }));
  };

  const travarFechamentoMensal = () => {
    if (!checkAdminPermission('Travar Fechamento Mensal')) return;
    setFechamentoMensal((prev) => ({
      ...prev,
      status: 'FECHADO',
      dataFechamento: new Date().toISOString().replace('T', ' ').substring(0, 19),
      fechadoPor: currentUser?.name
    }));
    showToast('Mês TRAVADO! Lançamentos no período foram consolidados.', 'success');
    addAuditLog('Fechamento Mensal', 'FECHAMENTO', `Aprovou o fechamento mensal de ${fechamentoMensal.mesAno} e travou o período`, 'EM_REVISAO', 'FECHADO');
  };

  const reabrirFechamentoMensal = () => {
    if (!checkAdminPermission('Reabrir Fechamento Mensal')) return;
    setFechamentoMensal((prev) => ({
      ...prev,
      status: 'EM_REVISAO'
    }));
    showToast('Período de fechamento reaberto para edições.', 'info');
    addAuditLog('Fechamento Mensal', 'EDICAO', `Reabriu o fechamento de ${fechamentoMensal.mesAno} para auditoria`, 'FECHADO', 'EM_REVISAO');
  };

  // --- Regras ---
  const toggleRegraAutomacao = (id: string) => {
    if (!checkAdminPermission('Alterar Regra de Automação')) return;
    setRegrasAutomacao((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ativa: !r.ativa } : r))
    );
  };

  const addRegraAutomacao = (r: Omit<RegraAutomacao, 'id'>) => {
    if (!checkAdminPermission('Criar Regra de Automação')) return;
    const id = 'aut-' + Date.now();
    setRegrasAutomacao((prev) => [...prev, { ...r, id }]);
    showToast('Nova regra de automação criada!', 'success');
  };

  // --- Users ---
  const addUser = (u: Omit<User, 'id' | 'lastAccess'>) => {
    if (!checkAdminPermission('Cadastrar Usuário')) return;
    if (users.some((user) => user.email.toLowerCase() === u.email.toLowerCase())) {
      showToast('Já existe um usuário cadastrado com este e-mail.', 'error');
      return;
    }
    const newU: User = {
      ...u,
      id: 'u-' + Date.now(),
      lastAccess: 'Nunca acessou'
    };
    setUsers((prev) => [...prev, newU]);
    showToast('Novo usuário adicionado!', 'success');
  };

  const updateUser = (id: string, changes: Partial<Omit<User, 'id' | 'lastAccess'>>) => {
    if (!checkAdminPermission('Editar Usuário')) return;
    if (changes.email && users.some((user) => user.id !== id && user.email.toLowerCase() === changes.email!.toLowerCase())) {
      showToast('Já existe outro usuário cadastrado com este e-mail.', 'error');
      return;
    }
    const existing = users.find((user) => user.id === id);
    if (!existing) return;
    const updatedUser = { ...existing, ...changes };
    setUsers((prev) => prev.map((user) => (user.id === id ? { ...user, ...changes } : user)));
    if (currentUser?.id === id) {
      setCurrentUserState(updatedUser);
      if (updatedUser.role === 'FINANCE') setSelectedUnitState(updatedUser.unit);
    }
    showToast('Usuário atualizado com sucesso!', 'success');
    addAuditLog('Usuários', 'EDICAO', `Atualizou o cadastro do usuário ID ${id}`);
  };

  const toggleUserActive = (id: string) => {
    if (!checkAdminPermission('Alterar Status de Usuário')) return;
    const user = users.find((item) => item.id === id);
    if (currentUser?.id === id && user?.active) {
      showToast('Não é possível desativar o próprio usuário durante a sessão.', 'error');
      return;
    }
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, active: !u.active } : u))
    );
  };

  const deleteUser = (id: string) => {
    if (!checkAdminPermission('Excluir Usuário')) return;
    if (currentUser?.id === id) {
      showToast('Não é possível excluir o próprio usuário durante a sessão.', 'error');
      return;
    }

    const user = users.find((item) => item.id === id);
    setUsers((prev) => prev.filter((item) => item.id !== id));
    showToast('Usuário excluído com sucesso.', 'success');
    addAuditLog('Usuários', 'EXCLUSAO', `Excluiu o usuário "${user?.name || id}"`);
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        selectedUnit,
        setSelectedUnit,
        currentView,
        setCurrentView,
        selectedDocumentForReviewId,
        setSelectedDocumentForReviewId,
        isAdmin,
        isFinance,
        isAuditor,
        canExecuteFinancialActions,
        canManageAdminSettings,
        units,
        categorias,
        centrosCusto,
        fornecedores,
        bancos,
        condicoesPagamento,
        lancamentos,
        filteredLancamentos,
        parcelamentos,
        filteredParcelamentos,
        documentosOCR,
        sessaoCaixa,
        fechamentoMensal,
        auditLogs,
        regrasAutomacao,
        dreData,
        users,
        toasts,
        showToast,
        addUnit,
        updateUnit,
        toggleUnitActive,
        deleteUnit,
        addCategoria,
        updateCategoria,
        toggleCategoriaActive,
        deleteCategoria,
        addCentroCusto,
        updateCentroCusto,
        toggleCentroCustoActive,
        deleteCentroCusto,
        addFornecedor,
        updateFornecedor,
        toggleFornecedorActive,
        deleteFornecedor,
        addBanco,
        updateBanco,
        toggleBancoActive,
        deleteBanco,
        addCondicaoPagamento,
        updateCondicaoPagamento,
        toggleCondicaoPagamentoActive,
        deleteCondicaoPagamento,
        addLancamento,
        addLancamentoComDDL,
        addLancamentoComParcelamento,
        addTransferencia,
        updateLancamento,
        deleteLancamento,
        marcarLancamentoComoPago,
        addParcelamento,
        pagarParcela,
        uploadDocumentoOCR,
        aprovarDocumentoOCR,
        conciliarDocumentoOCR,
        rejeitarDocumentoOCR,
        registrarMovimentacaoCaixa,
        ajustarSaldoCaixa,
        toggleChecklistItemFechamento,
        travarFechamentoMensal,
        reabrirFechamentoMensal,
        addAuditLog,
        toggleRegraAutomacao,
        addRegraAutomacao,
        addUser,
        updateUser,
        toggleUserActive,
        deleteUser,
        exportBackupJSON
      }}
    >
      {children}
      {/* Toast Notification Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white transition-all animate-bounce-short ${
              toast.type === 'success'
                ? 'bg-[#0f172a] border-l-4 border-[#C5A059]'
                : toast.type === 'error'
                ? 'bg-red-900 border-l-4 border-red-500'
                : 'bg-blue-900 border-l-4 border-blue-400'
            }`}
          >
            <span className="material-symbols-outlined text-lg">
              {toast.type === 'success' ? 'check_circle' : toast.type === 'error' ? 'error' : 'info'}
            </span>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
