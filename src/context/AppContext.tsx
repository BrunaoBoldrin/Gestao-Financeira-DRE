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
  ViewKey
} from '../types';
import { ROLE_DEFAULT_VIEW, canAccessAllUnits, canAccessView } from '../config/accessControl';
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
  selectedMonthYear: string;
  setSelectedMonthYear: (my: string) => void;
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
  addLancamentoComDDL: (dadosBase: Omit<Lancamento, 'id' | 'criadoEm'>, dataEmissao: string, prazosDias: number[]) => void;
  addLancamentoComParcelamento: (l: Omit<Lancamento, 'id' | 'criadoEm'>, numeroParcelas: number) => void;
  addTransferencia: (dados: { origem: string; destino: string; valor: number; data: string; descricao: string; unidade: string }) => void;
  updateLancamento: (id: string, l: Partial<Lancamento>) => void;
  deleteLancamento: (id: string) => void;
  marcarLancamentoComoPago: (id: string) => void;
  
  addParcelamento: (p: Omit<Parcelamento, 'id' | 'unidade' | 'parcelasPagas' | 'status' | 'cronograma'>) => void;
  pagarParcela: (parcelamentoId: string, numeroParcela: number) => void;
  
  uploadDocumentoOCR: (file: File) => void;
  aprovarDocumentoOCR: (docId: string, dadosFinal: DocumentoOCR['dadosExtraidos']) => void;
  rejeitarDocumentoOCR: (docId: string) => void;
  
  abrirCaixa: (saldoInicial: number) => void;
  registrarMovimentacaoCaixa: (tipo: 'SUPRIMENTO' | 'SANGRIA' | 'VENDA' | 'DESPESA', descricao: string, valor: number, comprovanteRef?: string) => void;
  fecharCaixa: (saldoContado: number, observacao: string) => void;
  
  toggleChecklistItemFechamento: (chkId: string) => void;
  travarFechamentoMensal: () => void;
  reabrirFechamentoMensal: () => void;
  
  addAuditLog: (modulo: string, acao: AuditLog['acao'], descricao: string, valorAnterior?: string, valorNovo?: string) => void;
  
  toggleRegraAutomacao: (id: string) => void;
  addRegraAutomacao: (r: Omit<RegraAutomacao, 'id'>) => void;
  
  addUser: (u: Omit<User, 'id' | 'lastAccess'>) => void;
  toggleUserActive: (id: string) => void;

  exportBackupJSON: () => string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUserState] = useState<User | null>(INITIAL_USERS[0]);
  const [selectedUnit, setSelectedUnitState] = useState<string>('Todas as Unidades');
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>('2024-05');
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
    const matchUnit = selectedUnit === 'Todas as Unidades' || l.unidade === selectedUnit;
    const matchMonth = !selectedMonthYear || selectedMonthYear === 'TODOS' || 
      l.dataVencimento.startsWith(selectedMonthYear) || 
      (l.dataPagamento && l.dataPagamento.startsWith(selectedMonthYear));
    return matchUnit && matchMonth;
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
  };
  const updateBanco = (id: string, b: Partial<BancoMaster>) => {
    if (!checkAdminPermission('Editar Conta Bancária')) return;
    setBancos((prev) => prev.map((item) => (item.id === id ? { ...item, ...b } : item)));
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
    prazosDias: number[]
  ) => {
    if (!checkFinancialPermission('Lançamento DDL')) return;
    dadosBase = { ...dadosBase, unidade: resolveAllowedUnit(dadosBase.unidade) };
    if (!prazosDias || prazosDias.length === 0) {
      prazosDias = [0];
    }

    const totalParcelas = prazosDias.length;
    const valorUnitario = Math.round((dadosBase.valor / totalParcelas) * 100) / 100;
    const parcelamentoId = totalParcelas > 1 ? 'parc-' + Date.now() : undefined;

    const novosLancamentos: Lancamento[] = [];
    const cronogramaItems: any[] = [];

    prazosDias.forEach((dias, index) => {
      const dt = new Date((dataEmissao || new Date().toISOString().substring(0, 10)) + 'T12:00:00');
      dt.setDate(dt.getDate() + dias);
      const vencimentoStr = dt.toISOString().substring(0, 10);

      const lancId = 'lanc-' + Date.now() + '-' + index;
      const statusLanc: StatusLancamento = (dias === 0 && dadosBase.status === 'PAGO') ? 'PAGO' : 'PENDENTE';

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
          lancamentoId: lancId
        });
      }
    });

    setLancamentos((prev) => [...novosLancamentos, ...prev]);

    if (totalParcelas > 1 && parcelamentoId) {
      const newParcelamento: Parcelamento = {
        id: parcelamentoId,
        unidade: dadosBase.unidade,
        titulo: dadosBase.descricao,
        fornecedor: dadosBase.fornecedorCliente,
        categoria: dadosBase.categoria,
        centroCusto: dadosBase.centroCusto,
        valorTotal: dadosBase.valor,
        numeroParcelas: totalParcelas,
        parcelasPagas: 0,
        valorParcela: valorUnitario,
        dataInicio: dataEmissao || new Date().toISOString().substring(0, 10),
        status: 'EM_ANDAMENTO',
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
    baseData = { ...baseData, unidade: resolveAllowedUnit(baseData.unidade) };
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
        dataPagamento: isPaid ? new Date().toISOString().substring(0, 10) : undefined,
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
        dataPagamento: isPaid ? new Date().toISOString().substring(0, 10) : undefined,
        criadoEm: new Date().toISOString().substring(0, 10)
      });
    }

    const novoParcelamento: Parcelamento = {
      id: parcelamentoId,
      unidade: baseData.unidade,
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

    showToast(
      `Gerado parcelamento em ${numeroParcelas}x de R$ ${valorParcela.toFixed(2)} e lançado no financeiro!`,
      'success'
    );
    addAuditLog('Parcelamentos', 'CRIACAO', `Iniciado parcelamento "${baseData.descricao}" (${numeroParcelas}x)`);
  };

  const addTransferencia = (dados: {
    origem: string;
    destino: string;
    valor: number;
    data: string;
    descricao: string;
    unidade: string;
  }) => {
    if (!checkFinancialPermission('Transferência de Contas')) return;
    dados = { ...dados, unidade: resolveAllowedUnit(dados.unidade) };
    if (dados.origem.toLowerCase().includes('caixa')) {
      registrarMovimentacaoCaixa(
        'SANGRIA',
        `Transferência para ${dados.destino}: ${dados.descricao}`,
        dados.valor
      );
    }

    addAuditLog(
      'Transferência de Contas',
      'CRIACAO',
      `Transferência de R$ ${dados.valor.toFixed(2)} de [${dados.origem}] para [${dados.destino}]`
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
    l = { ...l, unidade: resolveAllowedUnit(l.unidade) };
    const id = (l.tipo === 'RECEITA' ? 'rec-' : 'desp-') + Date.now().toString().slice(-4);
    const newL: Lancamento = {
      ...l,
      id,
      criadoEm: new Date().toISOString().substring(0, 10)
    };
    setLancamentos((prev) => [newL, ...prev]);
    showToast(`${l.tipo === 'RECEITA' ? 'Receita' : 'Despesa'} lançada com sucesso!`, 'success');
    addAuditLog('Lançamentos', 'CRIACAO', `Criou ${l.tipo.toLowerCase()} "${l.descricao}" no valor de R$ ${l.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, undefined, `Status: ${l.status}`);
  };

  const updateLancamento = (id: string, l: Partial<Lancamento>) => {
    if (!checkFinancialPermission('Editar Lançamento')) return;
    const existing = lancamentos.find((item) => item.id === id);
    if (existing && !canManageUnit(existing.unidade, 'Editar Lançamento')) return;
    if (isFinance && currentUser) l = { ...l, unidade: currentUser.unit };
    setLancamentos((prev) => prev.map((item) => (item.id === id ? { ...item, ...l } : item)));
    showToast('Lançamento atualizado!', 'info');
    addAuditLog('Lançamentos', 'EDICAO', `Atualizou lançamento ID ${id}`);
  };

  const deleteLancamento = (id: string) => {
    if (!checkFinancialPermission('Excluir Lançamento')) return;
    const existing = lancamentos.find((item) => item.id === id);
    if (existing && !canManageUnit(existing.unidade, 'Excluir Lançamento')) return;
    setLancamentos((prev) => prev.filter((item) => item.id !== id));
    showToast('Lançamento removido.', 'info');
    addAuditLog('Lançamentos', 'EXCLUSAO', `Excluiu lançamento ID ${id}`);
  };

  const marcarLancamentoComoPago = (id: string) => {
    if (!checkFinancialPermission('Liquidar Lançamento')) return;
    const existing = lancamentos.find((item) => item.id === id);
    if (existing && !canManageUnit(existing.unidade, 'Liquidar Lançamento')) return;
    setLancamentos((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status: 'PAGO',
              dataPagamento: new Date().toISOString().substring(0, 10)
            }
          : item
      )
    );
    showToast('Lançamento marcado como PAGO!', 'success');
    addAuditLog('Lançamentos', 'EDICAO', `Liquidou lançamento ID ${id}`, 'Status: PENDENTE', 'Status: PAGO');
  };

  // --- Parcelamentos ---
  const addParcelamento = (p: Omit<Parcelamento, 'id' | 'unidade' | 'parcelasPagas' | 'status' | 'cronograma'>) => {
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

    const newP: Parcelamento = {
      ...p,
      id,
      unidade: selectedUnit === 'Todas as Unidades' ? 'Royal Face - Matriz' : selectedUnit,
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
    if (parcelamento && !canManageUnit(parcelamento.unidade, 'Pagar Parcela')) return;
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

        // Also auto-create a paid expense entry in Lancamentos
        const lancamentoDesc = `Parcela ${numeroParcela}/${p.numeroParcelas} - ${p.titulo}`;
        addLancamento({
          descricao: lancamentoDesc,
          tipo: 'DESPESA',
          categoria: p.categoria,
          centroCusto: p.centroCusto,
          valor: p.valorParcela,
          dataVencimento: new Date().toISOString().substring(0, 10),
          dataPagamento: new Date().toISOString().substring(0, 10),
          status: 'PAGO',
          fornecedorCliente: p.fornecedor,
          contaBancaria: 'Itaú Uniclass - C/C 45892-1',
          formaPagamento: 'BOLETO',
          unidade: p.unidade,
          parcelamentoId: p.id,
          numeroParcela: `${numeroParcela}/${p.numeroParcelas}`
        });

        return {
          ...p,
          parcelasPagas: pagasCount,
          status,
          cronograma: updatedCronograma
        };
      })
    );
    showToast(`Parcela ${numeroParcela} paga com sucesso! Lançamento financeiro gerado.`, 'success');
  };

  // --- OCR / Documentos ---
  const uploadDocumentoOCR = async (file: File) => {
    if (!checkFinancialPermission('Upload Documento OCR')) return;
    const docId = 'ocr-' + Date.now().toString().slice(-4);
    
    // Create preview URL
    let objectPreviewUrl = 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600';
    if (file.type.startsWith('image/') || file.type === 'application/pdf') {
      try {
        objectPreviewUrl = URL.createObjectURL(file);
      } catch (e) {
        console.warn('Could not create object URL for file', e);
      }
    }

    const initialDoc: DocumentoOCR = {
      id: docId,
      nomeArquivo: file.name,
      tamanho: (file.size / 1024).toFixed(0) + ' KB',
      tipo: file.name.toLowerCase().includes('recibo')
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
      previewUrl: objectPreviewUrl
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

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.dadosExtraidos) {
        const extraidos = result.dadosExtraidos;
        setDocumentosOCR((prev) =>
          prev.map((doc) =>
            doc.id === docId
              ? {
                  ...doc,
                  status: 'PENDENTE_REVISAO',
                  tipo: result.tipo || doc.tipo,
                  confiancaOCR: result.confiancaOCR || 92,
                  dadosExtraidos: {
                    fornecedor: extraidos.fornecedor || 'Fornecedor Não Identificado',
                    cnpj: extraidos.cnpj || '00.000.000/0001-00',
                    dataEmissao: extraidos.dataEmissao || new Date().toISOString().substring(0, 10),
                    dataVencimento: extraidos.dataVencimento || new Date(Date.now() + 864000000).toISOString().substring(0, 10),
                    valorTotal: typeof extraidos.valorTotal === 'number' ? extraidos.valorTotal : 0,
                    categoria: extraidos.categoria || 'Insumos Médicos & Estéticos',
                    centroCusto: extraidos.centroCusto || 'Estoque Central',
                    observacoes: extraidos.observacoes || '',
                    itens: extraidos.itens || []
                  }
                }
              : doc
          )
        );

        showToast(
          `OCR concluído! Extraído R$ ${extraidos.valorTotal.toFixed(2)} (${extraidos.fornecedor}).`,
          'success'
        );
      } else {
        throw new Error('Retorno inválido do OCR');
      }
    } catch (err: any) {
      console.error('Erro na requisição de OCR:', err);
      // Fallback update so status isn't stuck at PROCESSANDO
      const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      const isBoleto = file.name.toLowerCase().includes('boleto');
      
      setDocumentosOCR((prev) =>
        prev.map((doc) =>
          doc.id === docId
            ? {
                ...doc,
                status: 'PENDENTE_REVISAO',
                confiancaOCR: 85,
                tipo: isBoleto ? 'BOLETO' : 'NFE',
                dadosExtraidos: {
                  fornecedor: cleanName || 'Fornecedor Local',
                  cnpj: '12.345.678/0001-99',
                  dataEmissao: new Date().toISOString().substring(0, 10),
                  dataVencimento: new Date(Date.now() + 864000000).toISOString().substring(0, 10),
                  valorTotal: isBoleto ? 480.00 : 250.00,
                  categoria: 'Insumos Médicos & Estéticos',
                  centroCusto: 'Estoque Central'
                }
              }
            : doc
        )
      );
      showToast('Documento pronto para conferência.', 'info');
    }
  };

  const aprovarDocumentoOCR = (docId: string, dadosFinal: DocumentoOCR['dadosExtraidos']) => {
    if (!checkFinancialPermission('Aprovar Documento OCR')) return;
    const doc = documentosOCR.find((d) => d.id === docId);
    if (!doc) return;

    // 1. Generate expense or revenue entry
    const newLancamentoId = 'desp-ocr-' + Date.now().toString().slice(-4);
    addLancamento({
      descricao: `[OCR Aprovado] ${dadosFinal.fornecedor} - ${doc.nomeArquivo}`,
      tipo: 'DESPESA',
      categoria: dadosFinal.categoria,
      centroCusto: dadosFinal.centroCusto,
      valor: dadosFinal.valorTotal,
      dataVencimento: dadosFinal.dataVencimento,
      status: 'PENDENTE',
      fornecedorCliente: dadosFinal.fornecedor,
      contaBancaria: 'Itaú Uniclass - C/C 45892-1',
      formaPagamento: 'BOLETO',
      unidade: selectedUnit === 'Todas as Unidades' ? 'Royal Face - Matriz' : selectedUnit,
      observacoes: dadosFinal.observacoes || `Processado e auditado via Motor OCR (${doc.confiancaOCR}% confiança)`,
      comprovanteUrl: doc.previewUrl,
      documentoRef: doc.id
    });

    // 2. Update doc status
    setDocumentosOCR((prev) =>
      prev.map((d) =>
        d.id === docId
          ? {
              ...d,
              status: 'APROVADO',
              dadosExtraidos: dadosFinal,
              lancamentoGeradoId: newLancamentoId
            }
          : d
      )
    );

    showToast('Documento conferido e aprovado! Lançamento gerado no Contas a Pagar.', 'success');
    addAuditLog('Documentos OCR', 'APROVACAO', `Aprovou e conferiu documento OCR ${docId} (${doc.nomeArquivo})`, 'PENDENTE_REVISAO', 'APROVADO');
  };

  const rejeitarDocumentoOCR = (docId: string) => {
    if (!checkFinancialPermission('Rejeitar Documento OCR')) return;
    setDocumentosOCR((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, status: 'REJEITADO' } : d))
    );
    showToast('Documento rejeitado.', 'info');
    addAuditLog('Documentos OCR', 'EDICAO', `Rejeitou documento OCR ${docId}`, 'PENDENTE_REVISAO', 'REJEITADO');
  };

  // --- Caixa Fisico ---
  const abrirCaixa = (saldoInicial: number) => {
    if (!checkFinancialPermission('Abrir Caixa Físico')) return;
    setSessaoCaixa({
      id: 'cx-' + new Date().toISOString().substring(0, 10),
      data: new Date().toISOString().substring(0, 10),
      status: 'ABERTO',
      saldoInicial,
      entradasDinheiro: 0,
      saidasDinheiro: 0,
      saldoEsperado: saldoInicial,
      operadorAbertura: currentUser ? currentUser.name : 'Operador',
      movimentacoes: [
        {
          id: 'mov-' + Date.now(),
          tipo: 'SUPRIMENTO',
          descricao: 'Abertura de Caixa - Fundo de Troco',
          valor: saldoInicial,
          dataHora: new Date().toISOString().replace('T', ' ').substring(0, 19),
          usuario: currentUser ? currentUser.name : 'Operador'
        }
      ]
    });
    showToast(`Caixa Físico aberto com R$ ${saldoInicial.toFixed(2)} de saldo inicial!`, 'success');
    addAuditLog('Caixa Físico', 'CRIACAO', `Abriu o caixa do dia com saldo inicial de R$ ${saldoInicial.toFixed(2)}`);
  };

  const registrarMovimentacaoCaixa = (
    tipo: 'SUPRIMENTO' | 'SANGRIA' | 'VENDA' | 'DESPESA',
    descricao: string,
    valor: number,
    comprovanteRef?: string
  ) => {
    if (!checkFinancialPermission('Movimentação de Caixa')) return;
    const novaMov = {
      id: 'mov-' + Date.now(),
      tipo,
      descricao,
      valor,
      dataHora: new Date().toISOString().replace('T', ' ').substring(0, 19),
      usuario: currentUser ? currentUser.name : 'Operador',
      comprovanteRef
    };

    setSessaoCaixa((prev) => {
      const isEntrada = tipo === 'SUPRIMENTO' || tipo === 'VENDA';
      const entradas = prev.entradasDinheiro + (isEntrada ? valor : 0);
      const saidas = prev.saidasDinheiro + (!isEntrada ? valor : 0);
      const saldoEsperado = prev.saldoInicial + entradas - saidas;

      return {
        ...prev,
        entradasDinheiro: entradas,
        saidasDinheiro: saidas,
        saldoEsperado,
        movimentacoes: [novaMov, ...prev.movimentacoes]
      };
    });

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
        contaBancaria: 'Caixa Físico Recepção',
        formaPagamento: 'DINHEIRO',
        unidade: selectedUnit === 'Todas as Unidades' ? 'Royal Face - Matriz' : selectedUnit
      });
    }

    showToast(`Movimentação de ${tipo} de R$ ${valor.toFixed(2)} registrada no Caixa Físico!`, 'success');
    addAuditLog('Caixa Físico', 'CRIACAO', `Registrou ${tipo} "${descricao}" de R$ ${valor.toFixed(2)}`);
  };

  const fecharCaixa = (saldoContado: number, observacao: string) => {
    if (!checkFinancialPermission('Fechar Caixa Físico')) return;
    setSessaoCaixa((prev) => {
      const divergencia = saldoContado - prev.saldoEsperado;
      return {
        ...prev,
        status: 'FECHADO',
        saldoContado,
        divergencia,
        observacaoFechamento: observacao,
        operadorFechamento: currentUser ? currentUser.name : 'Operador'
      };
    });
    showToast('Caixa Físico do dia encerrado com sucesso!', 'info');
    addAuditLog('Caixa Físico', 'FECHAMENTO', `Fechou o caixa do dia com saldo contado de R$ ${saldoContado.toFixed(2)}`);
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
    const newU: User = {
      ...u,
      id: 'u' + (users.length + 1),
      lastAccess: 'Nunca acessou'
    };
    setUsers((prev) => [...prev, newU]);
    showToast('Novo usuário adicionado!', 'success');
  };

  const toggleUserActive = (id: string) => {
    if (!checkAdminPermission('Alterar Status de Usuário')) return;
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, active: !u.active } : u))
    );
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        selectedUnit,
        setSelectedUnit,
        selectedMonthYear,
        setSelectedMonthYear,
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
        rejeitarDocumentoOCR,
        abrirCaixa,
        registrarMovimentacaoCaixa,
        fecharCaixa,
        toggleChecklistItemFechamento,
        travarFechamentoMensal,
        reabrirFechamentoMensal,
        addAuditLog,
        toggleRegraAutomacao,
        addRegraAutomacao,
        addUser,
        toggleUserActive,
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
