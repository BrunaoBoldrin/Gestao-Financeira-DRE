import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  User,
  Lancamento,
  StatusLancamento,
  Parcelamento,
  DocumentoOCR,
  SessaoCaixaFisico,
  FechamentoMensal,
  FechamentoCompetencia,
  AuditLog,
  RegraAutomacao,
  DREItem,
  DREVersion,
  UnitConfig,
  CategoriaMaster,
  CentroCustoMaster,
  FornecedorMaster,
  BancoMaster,
  CondicaoPagamento,
  ViewKey,
  DetalhesMovimentacaoCaixa,
  DadosLiquidacao,
  ApplicationStateSnapshot,
  PersistenceStatus
} from '../types';
import { ROLE_DEFAULT_VIEW, canAccessAllUnits, canAccessView } from '../config/accessControl';
import { calculateDueDateSchedule } from '../utils/financialDates';
import { getMonthValue, isMonthValue, normalizeDateValue, resolveReferenceMonth } from '../utils/dateRange';
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
import {
  createAuthUser,
  deleteAuthUser,
  getPersistenceAuthStatus,
  listAuthUsers,
  loginUser as loginUserApi,
  loadApplicationState,
  logoutUser as logoutUserApi,
  PersistenceApiError,
  saveApplicationState,
  setupInitialAdmin as setupInitialAdminApi,
  updateAuthUser
} from '../services/persistenceApi';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AppContextType {
  persistenceStatus: PersistenceStatus;
  persistenceMessage: string;
  flushPersistence: () => Promise<boolean>;
  loginUser: (username: string, password: string) => Promise<boolean>;
  setupInitialAdmin: (data: { setupToken: string; name: string; username: string; password: string }) => Promise<boolean>;
  logoutUser: () => Promise<void>;
  retryPersistence: () => void;
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
  fechamentosMensais: FechamentoCompetencia[];
  auditLogs: AuditLog[];
  regrasAutomacao: RegraAutomacao[];
  dreData: DREItem[];
  dreVersions: DREVersion[];
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
    primeiroVencimento?: string,
    options?: { adjustBankBalance?: boolean; notify?: boolean; audit?: boolean }
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
  updateLancamento: (id: string, l: Partial<Lancamento>) => boolean;
  deleteLancamento: (id: string) => void;
  marcarLancamentoComoPago: (id: string, dados: DadosLiquidacao) => boolean;
  
  addParcelamento: (p: Omit<Parcelamento, 'id' | 'parcelasPagas' | 'status' | 'cronograma'>) => void;
  pagarParcela: (parcelamentoId: string, numeroParcela: number, dados: DadosLiquidacao) => boolean;
  
  uploadDocumentoOCR: (file: File) => Promise<void>;
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
  
  iniciarFechamentoMensal: (mesAno: string) => void;
  toggleChecklistItemFechamento: (mesAno: string, chkId: string) => void;
  atualizarObservacoesFechamento: (mesAno: string, observacoes: string) => void;
  travarFechamentoMensal: (mesAno: string) => boolean;
  reabrirFechamentoMensal: (mesAno: string) => void;

  saveDREVersion: (data: Omit<DREVersion, 'id' | 'versao' | 'criadoEm' | 'criadoPor'>) => DREVersion | null;
  
  addAuditLog: (modulo: string, acao: AuditLog['acao'], descricao: string, valorAnterior?: string, valorNovo?: string) => void;
  
  toggleRegraAutomacao: (id: string) => void;
  addRegraAutomacao: (r: Omit<RegraAutomacao, 'id'>) => void;
  
  addUser: (u: Omit<User, 'id' | 'lastAccess'> & { password: string }) => Promise<boolean>;
  updateUser: (id: string, u: Partial<Omit<User, 'id' | 'lastAccess'>> & { password?: string }) => Promise<boolean>;
  toggleUserActive: (id: string) => Promise<boolean>;
  deleteUser: (id: string) => Promise<boolean>;

  exportBackupJSON: () => string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const createEntityId = (prefix: string) => {
  const randomId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${randomId}`;
};

const INITIAL_APPLICATION_STATE: ApplicationStateSnapshot = {
  units: INITIAL_UNITS,
  categorias: INITIAL_CATEGORIAS,
  centrosCusto: INITIAL_CENTROS_CUSTO,
  fornecedores: INITIAL_FORNECEDORES,
  bancos: INITIAL_BANCOS,
  condicoesPagamento: INITIAL_CONDICOES_PAGAMENTO,
  users: INITIAL_USERS,
  lancamentos: INITIAL_LANCAMENTOS,
  parcelamentos: INITIAL_PARCELAMENTOS,
  documentosOCR: INITIAL_DOCUMENTS_OCR,
  sessaoCaixa: INITIAL_SESSAO_CAIXA,
  fechamentoMensal: INITIAL_FECHAMENTO,
  fechamentosMensais: [],
  auditLogs: INITIAL_AUDIT_LOGS,
  regrasAutomacao: INITIAL_AUTOMATIONS,
  dreData: INITIAL_DRE,
  dreVersions: []
};

const createFechamentoChecklist = (): FechamentoMensal['checklist'] => [
  { id: 'conciliacao-bancaria', item: 'Conciliação bancária de todas as contas concluída', concluido: false },
  { id: 'contas-pagar-receber', item: 'Contas a pagar e a receber revisadas', concluido: false },
  { id: 'documentos-ocr', item: 'Documentos e pendências do OCR conferidos', concluido: false },
  { id: 'dre-revisado', item: 'DRE da competência revisado e validado', concluido: false }
];

const createFechamentoCompetencia = (mesAno: string): FechamentoCompetencia => ({
  id: `fech-${mesAno}`,
  mesAno,
  status: 'ABERTO',
  checklist: createFechamentoChecklist(),
  observacoes: ''
});

const normalizePersistedFinancialDates = (snapshot: ApplicationStateSnapshot): ApplicationStateSnapshot => {
  const lancamentos = snapshot.lancamentos.map((item) => {
    const dataVencimento = normalizeDateValue(item.dataVencimento);
    const dataCompetencia = normalizeDateValue(item.dataCompetencia) || dataVencimento;
    const dataPagamento = normalizeDateValue(item.dataPagamento);

    return {
      ...item,
      ...(dataVencimento ? { dataVencimento } : {}),
      ...(dataCompetencia ? { dataCompetencia } : {}),
      ...(item.dataPagamento && dataPagamento ? { dataPagamento } : {})
    };
  });
  const mesAno = resolveReferenceMonth(
    lancamentos.map((item) => item.dataCompetencia || item.dataVencimento),
    snapshot.fechamentoMensal?.mesAno
  );
  const persistedClosings = snapshot.fechamentosMensais || [];
  const normalizedClosings = persistedClosings.map((closing) => ({
    ...closing,
    id: closing.id || `fech-${closing.mesAno}`,
    checklist: closing.checklist?.length ? closing.checklist : createFechamentoChecklist()
  }));
  const existingReferenceClosing = normalizedClosings.find((closing) => closing.mesAno === mesAno);
  const legacyClosing = snapshot.fechamentoMensal?.mesAno === mesAno
    ? snapshot.fechamentoMensal
    : undefined;
  const referenceClosing: FechamentoCompetencia = existingReferenceClosing || {
    ...createFechamentoCompetencia(mesAno),
    ...legacyClosing,
    id: `fech-${mesAno}`,
    mesAno,
    checklist: legacyClosing?.checklist?.length ? legacyClosing.checklist : createFechamentoChecklist()
  };
  const fechamentosMensais = existingReferenceClosing
    ? normalizedClosings
    : [referenceClosing, ...normalizedClosings];
  const { id: _referenceClosingId, ...fechamentoMensal } = referenceClosing;

  return {
    ...snapshot,
    lancamentos,
    fechamentoMensal,
    fechamentosMensais,
    dreVersions: snapshot.dreVersions || []
  };
};

const persistentUrl = (value?: string) =>
  value && !value.startsWith('blob:') && !value.startsWith('data:') ? value : undefined;

const isPhysicalCashAccount = (account: Pick<BancoMaster, 'banco'>) =>
  account.banco.trim().toLocaleLowerCase('pt-BR').includes('caixa físico');

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [persistenceStatus, setPersistenceStatus] = useState<PersistenceStatus>('LOADING');
  const [persistenceMessage, setPersistenceMessage] = useState('Conectando ao banco de dados...');
  const [currentUser, setCurrentUserState] = useState<User | null>(null);
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
  const [fechamentosMensais, setFechamentosMensais] = useState<FechamentoCompetencia[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);
  const [regrasAutomacao, setRegrasAutomacao] = useState<RegraAutomacao[]>(INITIAL_AUTOMATIONS);
  const [dreData, setDreData] = useState<DREItem[]>(INITIAL_DRE);
  const [dreVersions, setDreVersions] = useState<DREVersion[]>([]);
  
  const [toasts, setToasts] = useState<Toast[]>([]);
  const revisionRef = useRef(0);
  const authenticatedUserRef = useRef<User | null>(null);
  const hydratedRef = useRef(false);
  const skipNextSaveRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveChainRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const latestSnapshotRef = useRef<ApplicationStateSnapshot>(INITIAL_APPLICATION_STATE);
  const hasUnsavedChangesRef = useRef(false);

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

  const persistentSnapshot = useMemo<ApplicationStateSnapshot>(() => ({
    units,
    categorias,
    centrosCusto,
    fornecedores,
    bancos,
    condicoesPagamento,
    users,
    lancamentos: lancamentos.map((item) => ({
      ...item,
      comprovanteUrl: persistentUrl(item.comprovanteUrl),
      documentoRef: persistentUrl(item.documentoRef) || (item.documentoRef?.startsWith('data:') ? undefined : item.documentoRef)
    })),
    parcelamentos,
    documentosOCR: documentosOCR.map((item) => ({
      ...item,
      previewUrl: persistentUrl(item.previewUrl) || ''
    })),
    sessaoCaixa: {
      ...sessaoCaixa,
      movimentacoes: sessaoCaixa.movimentacoes.map((item) => ({
        ...item,
        comprovanteRef: persistentUrl(item.comprovanteRef)
      }))
    },
    fechamentoMensal,
    fechamentosMensais,
    auditLogs,
    regrasAutomacao,
    dreData,
    dreVersions
  }), [
    units,
    categorias,
    centrosCusto,
    fornecedores,
    bancos,
    condicoesPagamento,
    users,
    lancamentos,
    parcelamentos,
    documentosOCR,
    sessaoCaixa,
    fechamentoMensal,
    fechamentosMensais,
    auditLogs,
    regrasAutomacao,
    dreData,
    dreVersions
  ]);

  const applyPersistentSnapshot = useCallback((snapshot: ApplicationStateSnapshot) => {
    skipNextSaveRef.current = true;
    const authenticatedUser = authenticatedUserRef.current;
    const storedAuthenticatedUser = authenticatedUser
      ? snapshot.users.find(
          (user) => user.id === authenticatedUser.id || user.username?.toLocaleLowerCase('pt-BR') === authenticatedUser.username?.toLocaleLowerCase('pt-BR')
        )
      : undefined;
    const effectiveAuthenticatedUser = authenticatedUser
      ? { ...storedAuthenticatedUser, ...authenticatedUser, avatarUrl: storedAuthenticatedUser?.avatarUrl }
      : null;
    const effectiveUsers = effectiveAuthenticatedUser
      ? [
          effectiveAuthenticatedUser,
          ...snapshot.users.filter(
            (user) => user.id !== effectiveAuthenticatedUser.id && user.username?.toLocaleLowerCase('pt-BR') !== effectiveAuthenticatedUser.username?.toLocaleLowerCase('pt-BR')
          )
        ]
      : snapshot.users;
    authenticatedUserRef.current = effectiveAuthenticatedUser;
    setUnits(snapshot.units);
    setCategorias(snapshot.categorias);
    setCentrosCusto(snapshot.centrosCusto);
    setFornecedores(snapshot.fornecedores);
    setBancos(snapshot.bancos);
    setCondicoesPagamento(snapshot.condicoesPagamento);
    setUsers(effectiveUsers);
    setLancamentos(snapshot.lancamentos);
    setParcelamentos(snapshot.parcelamentos);
    setDocumentosOCR(snapshot.documentosOCR);
    setSessaoCaixa(snapshot.sessaoCaixa);
    setFechamentoMensal(snapshot.fechamentoMensal);
    setFechamentosMensais(snapshot.fechamentosMensais);
    setAuditLogs(snapshot.auditLogs);
    setRegrasAutomacao(snapshot.regrasAutomacao);
    setDreData(snapshot.dreData);
    setDreVersions(snapshot.dreVersions);
    setCurrentUserState(effectiveAuthenticatedUser);
    setCurrentViewState(effectiveAuthenticatedUser ? ROLE_DEFAULT_VIEW[effectiveAuthenticatedUser.role] : 'overview');
    setSelectedUnitState(
      effectiveAuthenticatedUser && !canAccessAllUnits(effectiveAuthenticatedUser.role)
        ? effectiveAuthenticatedUser.unit
        : 'Todas as Unidades'
    );
    setSelectedDocumentForReviewId(
      snapshot.documentosOCR.find((document) => document.status === 'PENDENTE_REVISAO')?.id || null
    );
  }, []);

  const enqueueSnapshotSave = useCallback((snapshot: ApplicationStateSnapshot, notifyOnSuccess = true) => {
    const saveTask = saveChainRef.current.then(async () => {
      if (!hydratedRef.current) return false;
      setPersistenceStatus('SAVING');
      setPersistenceMessage('Salvando alterações...');
      try {
        const result = await saveApplicationState(revisionRef.current, snapshot);
        revisionRef.current = result.revision;
        if (latestSnapshotRef.current === snapshot) {
          hasUnsavedChangesRef.current = false;
        }
        setPersistenceStatus('CONNECTED');
        setPersistenceMessage(`Dados salvos · revisão ${result.revision}`);
        if (notifyOnSuccess) {
          showToast('Alterações confirmadas e salvas.', 'success');
        }
        return true;
      } catch (error) {
        if (error instanceof PersistenceApiError && error.status === 401) {
          hydratedRef.current = false;
          authenticatedUserRef.current = null;
          setCurrentUserState(null);
          setPersistenceStatus('AUTH_REQUIRED');
          setPersistenceMessage('A sessão expirou. Faça login novamente.');
          return false;
        }
        if (error instanceof PersistenceApiError && error.status === 409) {
          hydratedRef.current = false;
          setPersistenceStatus('CONFLICT');
          setPersistenceMessage('Outra sessão alterou os dados. Recarregue a versão mais recente antes de continuar.');
          return false;
        }
        setPersistenceStatus('ERROR');
        setPersistenceMessage(error instanceof Error ? error.message : 'Falha ao salvar.');
        return false;
      }
    });
    saveChainRef.current = saveTask;
    return saveTask;
  }, []);

  const flushPersistence = useCallback(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    if (persistenceStatus === 'LOCAL_DEMO') return true;
    if (!hydratedRef.current) return false;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const previousSaveSucceeded = await saveChainRef.current;
    if (!hasUnsavedChangesRef.current) return previousSaveSucceeded;
    return enqueueSnapshotSave(latestSnapshotRef.current, false);
  }, [enqueueSnapshotSave, persistenceStatus]);

  const hydratePersistence = useCallback(async () => {
    hydratedRef.current = false;
    setPersistenceStatus('LOADING');
    setPersistenceMessage('Conectando ao banco de dados...');
    try {
      const auth = await getPersistenceAuthStatus();
      if (!auth.databaseConfigured) {
        if (import.meta.env.DEV) {
          authenticatedUserRef.current = INITIAL_USERS[0];
          setCurrentUserState(INITIAL_USERS[0]);
          setPersistenceStatus('LOCAL_DEMO');
          setPersistenceMessage('Modo local de demonstração: configure a conexão para salvar os dados.');
        } else {
          setPersistenceStatus('ERROR');
          setPersistenceMessage('O banco de dados não está configurado. Cadastre as variáveis de conexão no Render.');
        }
        return;
      }
      if (!auth.encryptionConfigured) {
        setPersistenceStatus('ERROR');
        setPersistenceMessage('Configure APP_ENCRYPTION_KEY no Render antes de liberar o banco.');
        return;
      }
      if (auth.error) {
        setPersistenceStatus('ERROR');
        setPersistenceMessage(`Falha ao preparar o banco: ${auth.error}.`);
        return;
      }
      if (auth.setupRequired) {
        setPersistenceStatus('SETUP_REQUIRED');
        setPersistenceMessage(
          auth.setupTokenConfigured
            ? 'Crie o primeiro acesso de administrador.'
            : 'Configure APP_SETUP_TOKEN no Render para criar o administrador.'
        );
        return;
      }
      if (!auth.authenticated || !auth.user) {
        setPersistenceStatus('AUTH_REQUIRED');
        setPersistenceMessage('Informe seu nome de usuário e senha.');
        return;
      }
      authenticatedUserRef.current = auth.user;

      const stored = await loadApplicationState();
      revisionRef.current = stored.revision;
      let stateToApply: ApplicationStateSnapshot;
      if (stored.empty || !stored.data) {
        stateToApply = {
          ...INITIAL_APPLICATION_STATE,
          users: [auth.user]
        };
        const seeded = await saveApplicationState(
          stored.revision,
          stateToApply
        );
        revisionRef.current = seeded.revision;
      } else {
        stateToApply = stored.data;
      }
      stateToApply = normalizePersistedFinancialDates(stateToApply);
      if (auth.user.role === 'ADMIN') {
        const { users: authUsers } = await listAuthUsers();
        const legacyUsers = stateToApply.users.filter((storedUser) => !authUsers.some(
          (authUser) => authUser.id === storedUser.id || authUser.username?.toLocaleLowerCase('pt-BR') === storedUser.username?.toLocaleLowerCase('pt-BR')
        ));
        stateToApply = {
          ...stateToApply,
          users: [
            ...authUsers.map((authUser) => {
              const storedUser = stateToApply.users.find(
                (candidate) => candidate.id === authUser.id || candidate.username?.toLocaleLowerCase('pt-BR') === authUser.username?.toLocaleLowerCase('pt-BR')
              );
              return { ...storedUser, ...authUser, avatarUrl: storedUser?.avatarUrl };
            }),
            ...legacyUsers
          ]
        };
      }
      applyPersistentSnapshot(stateToApply);
      latestSnapshotRef.current = stateToApply;
      hasUnsavedChangesRef.current = false;
      hydratedRef.current = true;
      setPersistenceStatus('CONNECTED');
      setPersistenceMessage(`Dados sincronizados · revisão ${revisionRef.current}`);
    } catch (error) {
      if (error instanceof PersistenceApiError && error.status === 401) {
        setPersistenceStatus('AUTH_REQUIRED');
        setPersistenceMessage('Informe seu nome de usuário e senha.');
        return;
      }
      setPersistenceStatus('ERROR');
      setPersistenceMessage(error instanceof Error ? error.message : 'Não foi possível carregar o banco de dados.');
    }
  }, [applyPersistentSnapshot]);

  const loginUser = useCallback(async (username: string, password: string) => {
    try {
      const result = await loginUserApi(username, password);
      authenticatedUserRef.current = result.user;
      await hydratePersistence();
      return true;
    } catch (error) {
      setPersistenceStatus('AUTH_REQUIRED');
      setPersistenceMessage(error instanceof Error ? error.message : 'Não foi possível entrar.');
      return false;
    }
  }, [hydratePersistence]);

  const setupInitialAdmin = useCallback(async (data: {
    setupToken: string;
    name: string;
    username: string;
    password: string;
  }) => {
    try {
      const result = await setupInitialAdminApi(data);
      authenticatedUserRef.current = result.user;
      await hydratePersistence();
      return true;
    } catch (error) {
      setPersistenceStatus('SETUP_REQUIRED');
      setPersistenceMessage(error instanceof Error ? error.message : 'Não foi possível criar o administrador.');
      return false;
    }
  }, [hydratePersistence]);

  const logoutUser = useCallback(async () => {
    if (hasUnsavedChangesRef.current && !(await flushPersistence())) {
      showToast('Não foi possível sair: ainda existem alterações não salvas.', 'error');
      return;
    }
    try {
      await logoutUserApi();
    } finally {
      hydratedRef.current = false;
      authenticatedUserRef.current = null;
      setCurrentUserState(null);
      setPersistenceStatus('AUTH_REQUIRED');
      setPersistenceMessage('Sessão encerrada. Entre novamente para acessar os dados.');
    }
  }, [flushPersistence]);

  const retryPersistence = useCallback(() => {
    if (persistenceStatus === 'ERROR' && hydratedRef.current) {
      void enqueueSnapshotSave(latestSnapshotRef.current);
      return;
    }
    void hydratePersistence();
  }, [enqueueSnapshotSave, hydratePersistence, persistenceStatus]);

  useEffect(() => {
    void hydratePersistence();
  }, [hydratePersistence]);

  useEffect(() => {
    latestSnapshotRef.current = persistentSnapshot;
    if (!hydratedRef.current) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    hasUnsavedChangesRef.current = true;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void enqueueSnapshotSave(persistentSnapshot);
    }, 350);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [enqueueSnapshotSave, persistentSnapshot]);

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChangesRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, []);

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
    if (persistenceStatus !== 'LOCAL_DEMO' && !hydratedRef.current) {
      showToast(`Não é possível executar "${actionName}" enquanto os dados não estiverem sincronizados.`, 'error');
      return false;
    }
    return true;
  };

  const checkFinancialPermission = (actionName: string): boolean => {
    if (isAuditor) {
      showToast(`Acesso negado: Perfil Auditoria possui apenas acesso de leitura.`, 'error');
      return false;
    }
    if (persistenceStatus !== 'LOCAL_DEMO' && !hydratedRef.current) {
      showToast(`Não é possível executar "${actionName}" enquanto os dados não estiverem sincronizados.`, 'error');
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
      id: createEntityId('log'),
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
    if (!window.confirm('Tem certeza que deseja excluir esta filial?')) return;
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
    if (!window.confirm('Tem certeza que deseja excluir esta categoria?')) return;
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
    if (!window.confirm('Tem certeza que deseja excluir este centro de custo?')) return;
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
    if (!window.confirm('Tem certeza que deseja excluir este fornecedor?')) return;
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
    if (!window.confirm('Tem certeza que deseja excluir esta conta bancária?')) return;
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
    if (!window.confirm('Tem certeza que deseja excluir esta condição de pagamento?')) return;
    setCondicoesPagamento((prev) => prev.filter((item) => item.id !== id));
    showToast('Condição de pagamento removida.', 'info');
  };

  // --- Lancamentos CRUD & DDL / Parcelamento Automático ---
  const addLancamentoComDDL = (
    dadosBase: Omit<Lancamento, 'id' | 'criadoEm'>,
    dataEmissao: string,
    prazosDias: number[],
    primeiroVencimento?: string,
    options?: { adjustBankBalance?: boolean; notify?: boolean; audit?: boolean }
  ) => {
    if (!checkFinancialPermission('Lançamento DDL')) return;
    dadosBase = bindLancamentoToBanco({
      ...dadosBase,
      dataCompetencia: dadosBase.dataCompetencia || dataEmissao || dadosBase.dataVencimento,
      impactoDRE: dadosBase.impactoDRE || dadosBase.tipo,
      unidade: resolveAllowedUnit(dadosBase.unidade)
    });
    if (!ensureCompetenciaAberta(dadosBase.dataCompetencia || dadosBase.dataVencimento, 'criar lançamentos')) return;
    if (!ensurePaidLancamentoHasBanco(dadosBase)) return;
    if (!prazosDias || prazosDias.length === 0) {
      prazosDias = [0];
    }

    const totalParcelas = prazosDias.length;
    const valorUnitario = Math.round((dadosBase.valor / totalParcelas) * 100) / 100;
    const parcelamentoId = totalParcelas > 1 ? createEntityId('parc') : undefined;
    const vencimentos = calculateDueDateSchedule(dataEmissao, prazosDias, primeiroVencimento);

    const novosLancamentos: Lancamento[] = [];
    const cronogramaItems: any[] = [];

    prazosDias.forEach((dias, index) => {
      const vencimentoStr = vencimentos[index];

      const lancId = createEntityId('lanc');
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
    if (options?.adjustBankBalance !== false && paidBalanceDelta !== 0 && dadosBase.bancoId) {
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

    if (options?.audit !== false) {
      addAuditLog(
        'Lancamentos',
        'CRIACAO',
        `Lançamento criado com DDL (${prazosDias.join('/')} dias) gerando ${totalParcelas} boleto(s)`
      );
    }

    if (options?.notify !== false) {
      showToast('Lançamento preparado. Aguardando confirmação...', 'info');
    }
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
    if (!ensureCompetenciaAberta(baseData.dataCompetencia || baseData.dataVencimento, 'criar lançamentos')) return;
    if (!ensurePaidLancamentoHasBanco(baseData)) return;
    if (numeroParcelas <= 1) {
      addLancamento(baseData);
      return;
    }

    const valorTotal = baseData.valor;
    const valorParcela = Math.round((valorTotal / numeroParcelas) * 100) / 100;
    const parcelamentoId = createEntityId('parc');
    const dataInicio = baseData.dataVencimento;

    const cronograma: Parcelamento['cronograma'] = [];
    const novosLancamentos: Lancamento[] = [];

    for (let i = 1; i <= numeroParcelas; i++) {
      const dt = new Date(dataInicio + 'T00:00:00');
      dt.setMonth(dt.getMonth() + (i - 1));
      const vencimentoStr = dt.toISOString().substring(0, 10);
      const lancId = createEntityId('lanc');

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
    const origemCaixaFisico = isPhysicalCashAccount(origem);
    const destinoCaixaFisico = isPhysicalCashAccount(destino);
    const saldoOrigemApos = origem.saldo - dados.valor;
    if (origemCaixaFisico && saldoOrigemApos < 0) {
      showToast(`Saldo insuficiente no Caixa Físico de "${origem.unidade}".`, 'error');
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

    if (origemCaixaFisico) {
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
    } else if (destinoCaixaFisico) {
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
        fechamentosMensais,
        dreVersions,
        auditLogs
      },
      null,
      2
    );
  };

  const isCompetenciaFechada = (dateValue?: string) => {
    const month = getMonthValue(dateValue);
    return Boolean(month && fechamentosMensais.some(
      (closing) => closing.mesAno === month && closing.status === 'FECHADO'
    ));
  };

  const ensureCompetenciaAberta = (dateValue: string | undefined, action: string) => {
    if (!isCompetenciaFechada(dateValue)) return true;
    showToast(`A competência ${getMonthValue(dateValue)} está fechada. Reabra o mês antes de ${action}.`, 'error');
    return false;
  };

  // --- Lancamentos CRUD ---
  const addLancamento = (l: Omit<Lancamento, 'id' | 'criadoEm'>) => {
    if (!checkFinancialPermission('Criar Lançamento')) return;
    if (!ensureCompetenciaAberta(l.dataCompetencia || l.dataVencimento, 'criar lançamentos')) return;
    l = bindLancamentoToBanco({
      ...l,
      dataCompetencia: l.dataCompetencia || l.dataVencimento,
      impactoDRE: l.impactoDRE || l.tipo,
      unidade: resolveAllowedUnit(l.unidade)
    });
    if (!ensurePaidLancamentoHasBanco(l)) return;
    const id = createEntityId(l.tipo === 'RECEITA' ? 'rec' : 'desp');
    const newL: Lancamento = {
      ...l,
      id,
      criadoEm: new Date().toISOString().substring(0, 10)
    };
    setLancamentos((prev) => [newL, ...prev]);
    if (newL.status === 'PAGO' && newL.bancoId) {
      adjustBancoBalance(newL.bancoId, balanceDeltaForLancamento(newL), `Lançamento "${newL.descricao}"`);
    }
    addAuditLog('Lançamentos', 'CRIACAO', `Criou ${l.tipo.toLowerCase()} "${l.descricao}" no valor de R$ ${l.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, undefined, `Status: ${l.status}`);
  };

  const updateLancamento = (id: string, l: Partial<Lancamento>): boolean => {
    if (!checkFinancialPermission('Editar Lançamento')) return false;
    const existing = lancamentos.find((item) => item.id === id);
    if (!existing) return false;
    if (!ensureCompetenciaAberta(existing.dataCompetencia || existing.dataVencimento, 'editar lançamentos')) return false;
    if (!ensureCompetenciaAberta(l.dataCompetencia || l.dataVencimento, 'mover o lançamento para este mês')) return false;
    if (!canManageUnit(existing.unidade, 'Editar Lançamento')) return false;
    if (isFinance && currentUser) l = { ...l, unidade: currentUser.unit };
    const updated = bindLancamentoToBanco({ ...existing, ...l });
    if (!ensurePaidLancamentoHasBanco(updated)) return false;
    if (existing.status === 'PAGO') {
      const oldBank = resolveBancoForLancamento(existing);
      if (!oldBank) {
        showToast('Não foi possível estornar o saldo da conta anterior. Vincule uma conta válida.', 'error');
        return false;
      }
      adjustBancoBalance(oldBank.id, -balanceDeltaForLancamento(existing), `Estorno da edição de "${existing.descricao}"`);
    }
    if (updated.status === 'PAGO' && updated.bancoId) {
      adjustBancoBalance(updated.bancoId, balanceDeltaForLancamento(updated), `Edição de "${updated.descricao}"`);
    }
    setLancamentos((prev) => prev.map((item) => (item.id === id ? updated : item)));
    showToast('Alteração preparada. Aguardando confirmação...', 'info');
    addAuditLog(
      'Lançamentos',
      'EDICAO',
      `Atualizou lançamento ID ${id}`,
      `${existing.categoria} • ${existing.centroCusto}`,
      `${updated.categoria} • ${updated.centroCusto}`
    );
    return true;
  };

  const deleteLancamento = (id: string) => {
    if (!checkFinancialPermission('Excluir Lançamento')) return;
    const existing = lancamentos.find((item) => item.id === id);
    if (!existing) return;
    if (!ensureCompetenciaAberta(existing.dataCompetencia || existing.dataVencimento, 'excluir lançamentos')) return;
    if (existing && !canManageUnit(existing.unidade, 'Excluir Lançamento')) return;
    if (!window.confirm(`Tem certeza que deseja excluir o lançamento "${existing.descricao}"?${existing.status === 'PAGO' ? ' O valor será estornado no saldo da conta.' : ''}`)) return;
    if (existing.status === 'PAGO') {
      const banco = resolveBancoForLancamento(existing);
      if (!banco) {
        showToast('Não foi possível estornar o saldo: o lançamento não possui uma conta válida.', 'error');
        return;
      }
      adjustBancoBalance(banco.id, -balanceDeltaForLancamento(existing), `Exclusão de "${existing.descricao}"`);
    }
    setLancamentos((prev) => prev.filter((item) => item.id !== id));
    showToast('Lançamento excluído. Salvando alteração...', 'info');
    addAuditLog('Lançamentos', 'EXCLUSAO', `Excluiu lançamento ID ${id}`);
  };

  const marcarLancamentoComoPago = (id: string, dados: DadosLiquidacao): boolean => {
    if (!checkFinancialPermission('Liquidar Lançamento')) return false;
    const existing = lancamentos.find((item) => item.id === id);
    if (!existing) return false;
    if (!ensureCompetenciaAberta(existing.dataCompetencia || existing.dataVencimento, 'liquidar lançamentos')) return false;
    if (existing && !canManageUnit(existing.unidade, 'Liquidar Lançamento')) return false;
    if (existing.status === 'PAGO') {
      showToast('Este lançamento já está pago.', 'info');
      return false;
    }
    const banco = bancos.find(
      (item) => item.id === dados.bancoId && item.ativo && item.unidade === existing.unidade
    );
    if (!banco) {
      showToast(`Selecione uma conta bancária ativa da unidade "${existing.unidade}".`, 'error');
      return false;
    }
    if (!dados.formaPagamento || !dados.dataPagamento) {
      showToast('Informe a forma e a data do pagamento antes de liquidar.', 'error');
      return false;
    }
    const paidLancamento: Lancamento = {
      ...existing,
      status: 'PAGO' as const,
      bancoId: banco.id,
      contaBancaria: banco.banco,
      formaPagamento: dados.formaPagamento,
      dataPagamento: dados.dataPagamento
    };
    if (!ensurePaidLancamentoHasBanco(paidLancamento)) return false;
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
    addAuditLog(
      'Lançamentos',
      'EDICAO',
      `Liquidou lançamento ID ${id} em "${banco.banco}" via ${dados.formaPagamento}`,
      'Status: PENDENTE',
      `Status: PAGO | Data: ${dados.dataPagamento} | Conta: ${banco.banco} | Forma: ${dados.formaPagamento}`
    );
    return true;
  };

  // --- Parcelamentos ---
  const addParcelamento = (p: Omit<Parcelamento, 'id' | 'parcelasPagas' | 'status' | 'cronograma'>) => {
    if (!checkFinancialPermission('Criar Parcelamento')) return;
    if (!ensureCompetenciaAberta(p.dataInicio, 'criar parcelamentos')) return;
    const id = createEntityId('parc');
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

  const pagarParcela = (parcelamentoId: string, numeroParcela: number, dados: DadosLiquidacao): boolean => {
    if (!checkFinancialPermission('Pagar Parcela')) return false;
    const parcelamento = parcelamentos.find((item) => item.id === parcelamentoId);
    if (!parcelamento) return false;
    if (parcelamento && !canManageUnit(parcelamento.unidade, 'Pagar Parcela')) return false;
    const parcela = parcelamento.cronograma.find((item) => item.numero === numeroParcela);
    if (!parcela || parcela.status === 'PAGO') {
      showToast('Esta parcela já está paga ou não foi localizada.', 'info');
      return false;
    }
    const linkedLancamento = parcela.lancamentoId
      ? lancamentos.find((item) => item.id === parcela.lancamentoId)
      : undefined;
    if (linkedLancamento && !ensureCompetenciaAberta(
      linkedLancamento.dataCompetencia || linkedLancamento.dataVencimento,
      'liquidar parcelas'
    )) return false;
    const banco = bancos.find(
      (item) => item.id === dados.bancoId && item.ativo && item.unidade === parcelamento.unidade
    );
    if (!banco) {
      showToast(
        `Selecione uma conta bancária ativa de ${parcelamento.unidade} antes de pagar a parcela.`,
        'error'
      );
      return false;
    }
    if (!dados.formaPagamento || !dados.dataPagamento) {
      showToast('Informe a forma e a data do pagamento da parcela.', 'error');
      return false;
    }

    if (linkedLancamento) {
      if (!marcarLancamentoComoPago(linkedLancamento.id, dados)) return false;
    } else {
      addLancamento({
        descricao: `Parcela ${numeroParcela}/${parcelamento.numeroParcelas} - ${parcelamento.titulo}`,
        tipo: 'DESPESA',
        categoria: parcelamento.categoria,
        centroCusto: parcelamento.centroCusto,
        valor: parcela.valor,
        dataVencimento: parcela.vencimento,
        dataPagamento: dados.dataPagamento,
        status: 'PAGO',
        fornecedorCliente: parcelamento.fornecedor,
        bancoId: banco.id,
        contaBancaria: banco.banco,
        formaPagamento: dados.formaPagamento,
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
            ? {
                ...c,
                status: 'PAGO' as const,
                dataPagamento: dados.dataPagamento,
                bancoId: banco.id,
                contaBancaria: banco.banco,
                formaPagamento: dados.formaPagamento
              }
            : c
        );
        const pagasCount = updatedCronograma.filter((c) => c.status === 'PAGO').length;
        const status = pagasCount === p.numeroParcelas ? 'CONCLUIDO' : 'EM_ANDAMENTO';

        return {
          ...p,
          bancoId: banco.id,
          contaBancaria: banco.banco,
          parcelasPagas: pagasCount,
          status,
          cronograma: updatedCronograma
        };
      })
    );
    return true;
  };

  // --- OCR / Documentos ---
  const uploadDocumentoOCR = async (file: File) => {
    if (!checkFinancialPermission('Upload Documento OCR')) return;
    const docId = createEntityId('ocr');
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
          formaPagamento: extraidos.formaPagamento,
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
          previewUrl: result.metadados?.previewUrl || initialDoc.previewUrl,
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
        isPhysicalCashAccount(banco)
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
      id: createEntityId('mov'),
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
          id: createEntityId('mov'),
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
  const syncLegacyFechamento = (record: FechamentoCompetencia) => {
    if (record.mesAno !== fechamentoMensal.mesAno) return;
    const { id: _recordId, ...legacyRecord } = record;
    setFechamentoMensal(legacyRecord);
  };

  const iniciarFechamentoMensal = (mesAno: string) => {
    if (!checkFinancialPermission('Iniciar Fechamento Mensal')) return;
    if (!isMonthValue(mesAno)) {
      showToast('Selecione uma competência válida para iniciar o fechamento.', 'error');
      return;
    }
    if (fechamentosMensais.some((item) => item.mesAno === mesAno)) return;
    const newClosing = createFechamentoCompetencia(mesAno);
    setFechamentosMensais((prev) => [newClosing, ...prev]);
    syncLegacyFechamento(newClosing);
    addAuditLog('Fechamento Mensal', 'CRIACAO', `Iniciou o fechamento da competência ${mesAno}`);
    showToast(`Fechamento de ${mesAno} iniciado.`, 'success');
  };

  const updateFechamentoRecord = (
    mesAno: string,
    updater: (record: FechamentoCompetencia) => FechamentoCompetencia
  ) => {
    const currentRecord = fechamentosMensais.find((record) => record.mesAno === mesAno);
    if (!currentRecord) return;
    const updatedRecord = updater(currentRecord);
    setFechamentosMensais((prev) => prev.map((record) =>
      record.mesAno === mesAno ? updatedRecord : record
    ));
    syncLegacyFechamento(updatedRecord);
  };

  const toggleChecklistItemFechamento = (mesAno: string, chkId: string) => {
    if (!checkFinancialPermission('Alterar Checklist de Fechamento')) return;
    const closing = fechamentosMensais.find((item) => item.mesAno === mesAno);
    if (!closing || closing.status === 'FECHADO') return;
    updateFechamentoRecord(mesAno, (record) => ({
      ...record,
      status: record.status === 'ABERTO' ? 'EM_REVISAO' : record.status,
      checklist: record.checklist.map((c) =>
        c.id === chkId ? { ...c, concluido: !c.concluido, responsavel: currentUser?.name } : c
      )
    }));
  };

  const atualizarObservacoesFechamento = (mesAno: string, observacoes: string) => {
    if (!checkFinancialPermission('Editar Observações do Fechamento')) return;
    updateFechamentoRecord(mesAno, (record) => ({ ...record, observacoes }));
  };

  const travarFechamentoMensal = (mesAno: string): boolean => {
    if (!checkAdminPermission('Travar Fechamento Mensal')) return false;
    const closing = fechamentosMensais.find((item) => item.mesAno === mesAno);
    if (!closing) {
      showToast('Inicie o fechamento desta competência antes de travá-la.', 'error');
      return false;
    }
    if (closing.checklist.length === 0 || closing.checklist.some((item) => !item.concluido)) {
      showToast('Conclua todo o checklist antes de travar a competência.', 'error');
      return false;
    }
    const updatedRecord: FechamentoCompetencia = {
      ...closing,
      status: 'FECHADO',
      dataFechamento: new Date().toISOString().replace('T', ' ').substring(0, 19),
      fechadoPor: currentUser?.name
    };
    updateFechamentoRecord(mesAno, () => updatedRecord);
    showToast('Mês TRAVADO! Lançamentos no período foram consolidados.', 'success');
    addAuditLog('Fechamento Mensal', 'FECHAMENTO', `Aprovou o fechamento mensal de ${mesAno} e travou o período`, closing.status, 'FECHADO');
    return true;
  };

  const reabrirFechamentoMensal = (mesAno: string) => {
    if (!checkAdminPermission('Reabrir Fechamento Mensal')) return;
    const closing = fechamentosMensais.find((item) => item.mesAno === mesAno);
    if (!closing) return;
    updateFechamentoRecord(mesAno, (record) => ({
      ...record,
      status: 'EM_REVISAO',
      dataFechamento: undefined,
      fechadoPor: undefined
    }));
    showToast('Período de fechamento reaberto para edições.', 'info');
    addAuditLog('Fechamento Mensal', 'EDICAO', `Reabriu o fechamento de ${mesAno} para auditoria`, closing.status, 'EM_REVISAO');
  };

  const saveDREVersion = (
    data: Omit<DREVersion, 'id' | 'versao' | 'criadoEm' | 'criadoPor'>
  ): DREVersion | null => {
    if (!checkFinancialPermission('Salvar Versão Manual do DRE')) return null;
    if (!isMonthValue(data.mesAno)) {
      showToast('Selecione uma competência válida para salvar o DRE.', 'error');
      return null;
    }
    if (isFinance && currentUser && data.unidade !== currentUser.unit) {
      showToast('O perfil Financeiro só pode salvar o DRE da própria unidade.', 'error');
      return null;
    }
    if (fechamentosMensais.some((item) => item.mesAno === data.mesAno && item.status === 'FECHADO')) {
      showToast('Reabra a competência antes de salvar uma nova versão do DRE.', 'error');
      return null;
    }
    if (data.valoresBase.some((item) => !Number.isFinite(item.valor))) {
      showToast('Revise os valores manuais do DRE.', 'error');
      return null;
    }
    const previousVersion = dreVersions
      .filter((item) => item.mesAno === data.mesAno && item.unidade === data.unidade)
      .reduce((max, item) => Math.max(max, item.versao), 0);
    const newVersion: DREVersion = {
      ...data,
      id: createEntityId('dre-versao'),
      versao: previousVersion + 1,
      criadoEm: new Date().toISOString(),
      criadoPor: currentUser?.name || 'Usuário'
    };
    setDreVersions((prev) => [newVersion, ...prev]);
    addAuditLog(
      'DRE Gerencial',
      'EDICAO',
      `Salvou a versão ${newVersion.versao} do DRE de ${data.mesAno} — ${data.unidade}`,
      previousVersion ? `Versão ${previousVersion}` : 'Cálculo automático',
      `Versão ${newVersion.versao}`
    );
    showToast(`Versão ${newVersion.versao} do DRE preparada para salvar.`, 'success');
    return newVersion;
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
    const id = createEntityId('aut');
    setRegrasAutomacao((prev) => [...prev, { ...r, id }]);
    showToast('Nova regra de automação criada!', 'success');
  };

  // --- Users ---
  const addUser = async (u: Omit<User, 'id' | 'lastAccess'> & { password: string }) => {
    if (!checkAdminPermission('Cadastrar Usuário')) return false;
    if (users.some((user) => user.username?.toLowerCase() === u.username?.toLowerCase())) {
      showToast('Já existe um usuário cadastrado com este nome de usuário.', 'error');
      return false;
    }
    const { password, avatarUrl, ...profile } = u;
    try {
      const result = await createAuthUser({ ...profile, password });
      setUsers((prev) => [...prev, { ...result.user, avatarUrl }]);
      showToast('Usuário e acesso criados com sucesso!', 'success');
      addAuditLog('Usuários', 'CRIACAO', `Criou o acesso do usuário "${result.user.name}"`);
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Não foi possível criar o usuário.', 'error');
      return false;
    }
  };

  const updateUser = async (
    id: string,
    changes: Partial<Omit<User, 'id' | 'lastAccess'>> & { password?: string }
  ) => {
    if (!checkAdminPermission('Editar Usuário')) return false;
    if (currentUser?.id === id) {
      showToast('Não é possível alterar o próprio usuário nesta tela.', 'error');
      return false;
    }
    if (changes.username && users.some((user) => user.id !== id && user.username?.toLowerCase() === changes.username!.toLowerCase())) {
      showToast('Já existe outro usuário cadastrado com este nome de usuário.', 'error');
      return false;
    }
    const existing = users.find((user) => user.id === id);
    if (!existing) return false;
    const { password, ...profileChanges } = changes;
    const updated = { ...existing, ...profileChanges };
    const avatarUrl = Object.prototype.hasOwnProperty.call(profileChanges, 'avatarUrl')
      ? profileChanges.avatarUrl
      : existing.avatarUrl;

    try {
      let result;
      try {
        result = await updateAuthUser(id, {
          name: updated.name,
          username: updated.username,
          role: updated.role,
          unit: updated.unit,
          active: updated.active,
          ...(password ? { password } : {})
        });
      } catch (error) {
        if (!(error instanceof PersistenceApiError) || error.status !== 404) throw error;
        if (!password) {
          showToast('Defina uma senha para liberar o acesso deste cadastro antigo.', 'error');
          return false;
        }
        result = await createAuthUser({
          name: updated.name,
          username: updated.username,
          password,
          role: updated.role,
          unit: updated.unit,
          active: updated.active
        });
      }

      setUsers((prev) => prev.map((user) => (
        user.id === id ? { ...result.user, avatarUrl } : user
      )));
      showToast('Usuário atualizado com sucesso!', 'success');
      addAuditLog('Usuários', 'EDICAO', `Atualizou o cadastro do usuário "${updated.name}"`);
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Não foi possível atualizar o usuário.', 'error');
      return false;
    }
  };

  const toggleUserActive = async (id: string) => {
    if (!checkAdminPermission('Alterar Status de Usuário')) return false;
    const user = users.find((item) => item.id === id);
    if (currentUser?.id === id && user?.active) {
      showToast('Não é possível desativar o próprio usuário durante a sessão.', 'error');
      return false;
    }
    if (!user) return false;
    try {
      const result = await updateAuthUser(id, {
        name: user.name,
        username: user.username,
        role: user.role,
        unit: user.unit,
        active: !user.active
      });
      setUsers((prev) => prev.map((item) => (
        item.id === id ? { ...result.user, avatarUrl: item.avatarUrl } : item
      )));
      showToast(result.user.active ? 'Usuário ativado.' : 'Usuário desativado.', 'success');
      addAuditLog('Usuários', 'EDICAO', `${result.user.active ? 'Ativou' : 'Desativou'} o usuário "${user.name}"`);
      return true;
    } catch (error) {
      const message = error instanceof PersistenceApiError && error.status === 404
        ? 'Edite este cadastro e defina uma senha antes de liberar o acesso.'
        : error instanceof Error ? error.message : 'Não foi possível alterar o usuário.';
      showToast(message, 'error');
      return false;
    }
  };

  const deleteUser = async (id: string) => {
    if (!checkAdminPermission('Excluir Usuário')) return false;
    if (currentUser?.id === id) {
      showToast('Não é possível excluir o próprio usuário durante a sessão.', 'error');
      return false;
    }

    const user = users.find((item) => item.id === id);
    try {
      await deleteAuthUser(id);
    } catch (error) {
      if (!(error instanceof PersistenceApiError) || error.status !== 404) {
        showToast(error instanceof Error ? error.message : 'Não foi possível excluir o usuário.', 'error');
        return false;
      }
    }
    setUsers((prev) => prev.filter((item) => item.id !== id));
    showToast('Usuário excluído com sucesso.', 'success');
    addAuditLog('Usuários', 'EXCLUSAO', `Excluiu o usuário "${user?.name || id}"`);
    return true;
  };

  return (
    <AppContext.Provider
      value={{
        persistenceStatus,
        persistenceMessage,
        flushPersistence,
        loginUser,
        setupInitialAdmin,
        logoutUser,
        retryPersistence,
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
        fechamentosMensais,
        auditLogs,
        regrasAutomacao,
        dreData,
        dreVersions,
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
        iniciarFechamentoMensal,
        toggleChecklistItemFechamento,
        atualizarObservacoesFechamento,
        travarFechamentoMensal,
        reabrirFechamentoMensal,
        saveDREVersion,
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
