import { 
  User, 
  Lancamento, 
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
  CondicaoPagamento
} from '../types';

export const INITIAL_USERS: User[] = [
  {
    id: 'u1',
    name: 'Ana Claudia Silva',
    email: 'ana.silva@royalface.com.br',
    role: 'ADMIN',
    unit: 'Royal Face - Matriz',
    active: true,
    lastAccess: '2024-05-18 14:32:00',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'
  },
  {
    id: 'u2',
    name: 'Carlos Eduardo Santos',
    email: 'carlos.santos@royalface.com.br',
    role: 'FINANCE',
    unit: 'Royal Face - Unidade Centro',
    active: true,
    lastAccess: '2024-05-18 11:15:22',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150'
  },
  {
    id: 'u3',
    name: 'Mariana Oliveira',
    email: 'mariana.auditoria@royalface.com.br',
    role: 'AUDITOR',
    unit: 'Todas as Unidades',
    active: true,
    lastAccess: '2024-05-17 16:45:10',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
  }
];

export const INITIAL_UNITS: UnitConfig[] = [
  { id: 'matriz', nome: 'Royal Face - Matriz', cnpj: '34.567.890/0001-12', razaoSocial: 'Royal Face Estética Facial Ltda', cidade: 'São Paulo/SP', ativa: true },
  { id: 'centro', nome: 'Royal Face - Unidade Centro', cnpj: '34.567.890/0002-95', razaoSocial: 'Royal Face Centro Estética Ltda', cidade: 'Campinas/SP', ativa: true },
  { id: 'moema', nome: 'Royal Face - Moema', cnpj: '34.567.890/0003-88', razaoSocial: 'Royal Face Moema Estética Ltda', cidade: 'São Paulo/SP', ativa: true },
  { id: 'jardins', nome: 'Royal Face - Jardins', cnpj: '34.567.890/0004-70', razaoSocial: 'Royal Face Jardins Ltda', cidade: 'São Paulo/SP', ativa: true },
];

export const INITIAL_CATEGORIAS: CategoriaMaster[] = [
  { id: 'cat-1', codigo: '1.01', nome: 'Procedimentos Estéticos', tipo: 'RECEITA', grupoDRE: 'RECEITA_BRUTA', ativa: true },
  { id: 'cat-2', codigo: '1.02', nome: 'Venda de Produtos', tipo: 'RECEITA', grupoDRE: 'RECEITA_BRUTA', ativa: true },
  { id: 'cat-3', codigo: '8.01', nome: 'Outras Receitas Operacionais', tipo: 'RECEITA', grupoDRE: 'OUTRA_RECEITA_OPERACIONAL', ativa: true },
  { id: 'cat-4', codigo: '4.01', nome: 'Insumos Médicos & Estéticos', tipo: 'DESPESA', grupoDRE: 'CUSTO_SERVICO_PRODUTO', ativa: true },
  { id: 'cat-5', codigo: '7.01', nome: 'Outras Despesas de Ocupação & Infraestrutura', tipo: 'DESPESA', grupoDRE: 'DESPESA_ADMINISTRATIVA', ativa: true },
  { id: 'cat-6', codigo: '6.01', nome: 'Marketing & Publicidade', tipo: 'DESPESA', grupoDRE: 'DESPESA_VENDAS', ativa: true },
  { id: 'cat-7', codigo: '7.02', nome: 'Salários & Encargos Administrativos', tipo: 'DESPESA', grupoDRE: 'DESPESA_ADMINISTRATIVA', ativa: true },
  { id: 'cat-8', codigo: '7.03', nome: 'Energia Elétrica', tipo: 'DESPESA', grupoDRE: 'DESPESA_ADMINISTRATIVA', ativa: true },
  { id: 'cat-9', codigo: '7.04', nome: 'Manutenção & Equipamentos', tipo: 'DESPESA', grupoDRE: 'DESPESA_ADMINISTRATIVA', ativa: true },
  { id: 'cat-10', codigo: '7.05', nome: 'Serviços Terceirizados', tipo: 'DESPESA', grupoDRE: 'DESPESA_ADMINISTRATIVA', ativa: true },
  { id: 'cat-11', codigo: '7.06', nome: 'Softwares & Sistemas', tipo: 'DESPESA', grupoDRE: 'DESPESA_ADMINISTRATIVA', ativa: true },
  { id: 'cat-12', codigo: '2.01', nome: 'Tributos sobre Faturamento', tipo: 'DESPESA', grupoDRE: 'DEDUCAO_RECEITA', ativa: true },
  { id: 'cat-13', codigo: '2.02', nome: 'Cancelamentos, Estornos & Descontos', tipo: 'DESPESA', grupoDRE: 'DEDUCAO_RECEITA', ativa: true },
  { id: 'cat-14', codigo: '4.02', nome: 'Comissões Clínicas & Aplicadores', tipo: 'DESPESA', grupoDRE: 'CUSTO_SERVICO_PRODUTO', ativa: true },
  { id: 'cat-15', codigo: '4.03', nome: 'Salários da Equipe Clínica', tipo: 'DESPESA', grupoDRE: 'CUSTO_SERVICO_PRODUTO', ativa: true },
  { id: 'cat-16', codigo: '6.02', nome: 'Taxas de Maquininha — Débito', tipo: 'DESPESA', grupoDRE: 'DESPESA_VENDAS', ativa: true },
  { id: 'cat-17', codigo: '6.03', nome: 'Royalties', tipo: 'DESPESA', grupoDRE: 'DESPESA_VENDAS', ativa: true },
  { id: 'cat-18', codigo: '7.07', nome: 'Aluguel, Condomínio & IPTU', tipo: 'DESPESA', grupoDRE: 'DESPESA_ADMINISTRATIVA', ativa: true },
  { id: 'cat-19', codigo: '7.08', nome: 'Limpeza', tipo: 'DESPESA', grupoDRE: 'DESPESA_ADMINISTRATIVA', ativa: true },
  { id: 'cat-20', codigo: '8.02', nome: 'Outras Despesas Operacionais', tipo: 'DESPESA', grupoDRE: 'OUTRA_DESPESA_OPERACIONAL', ativa: true },
  { id: 'cat-21', codigo: '10.01', nome: 'Depreciação & Amortização', tipo: 'DESPESA', grupoDRE: 'DEPRECIACAO_AMORTIZACAO', ativa: true },
  { id: 'cat-22', codigo: '12.01', nome: 'Receitas Financeiras', tipo: 'RECEITA', grupoDRE: 'RECEITA_FINANCEIRA', ativa: true },
  { id: 'cat-23', codigo: '12.02', nome: 'Tarifas, Juros & Despesas Financeiras', tipo: 'DESPESA', grupoDRE: 'DESPESA_FINANCEIRA', ativa: true },
  { id: 'cat-24', codigo: '14.01', nome: 'IRPJ & CSLL', tipo: 'DESPESA', grupoDRE: 'TRIBUTO_LUCRO', ativa: true },
  { id: 'cat-25', codigo: '0.01', nome: 'Movimentações sem Impacto no DRE', tipo: 'DESPESA', grupoDRE: 'NAO_AFETA_DRE', ativa: true },
  { id: 'cat-26', codigo: '0.02', nome: 'Investimento em Equipamentos (Capex)', tipo: 'DESPESA', grupoDRE: 'NAO_AFETA_DRE', ativa: true },
  { id: 'cat-27', codigo: '0.03', nome: 'Obras & Benfeitorias', tipo: 'DESPESA', grupoDRE: 'NAO_AFETA_DRE', ativa: true },
  { id: 'cat-28', codigo: '0.04', nome: 'Principal de Empréstimos', tipo: 'DESPESA', grupoDRE: 'NAO_AFETA_DRE', ativa: true },
  { id: 'cat-29', codigo: '0.05', nome: 'Aportes & Transferências Recebidas', tipo: 'RECEITA', grupoDRE: 'NAO_AFETA_DRE', ativa: true },
  { id: 'cat-30', codigo: '0.06', nome: 'Retiradas & Transferências Enviadas', tipo: 'DESPESA', grupoDRE: 'NAO_AFETA_DRE', ativa: true },
  { id: 'cat-31', codigo: '6.04', nome: 'Taxas de Maquininha — Crédito', tipo: 'DESPESA', grupoDRE: 'DESPESA_VENDAS', ativa: true },
  { id: 'cat-32', codigo: '7.09', nome: 'Água & Esgoto', tipo: 'DESPESA', grupoDRE: 'DESPESA_ADMINISTRATIVA', ativa: true },
  { id: 'cat-33', codigo: '7.10', nome: 'Clinicorp / Software de Gestão', tipo: 'DESPESA', grupoDRE: 'DESPESA_ADMINISTRATIVA', ativa: true },
  { id: 'cat-34', codigo: '7.11', nome: 'Microfocado / Equipamentos', tipo: 'DESPESA', grupoDRE: 'DESPESA_ADMINISTRATIVA', ativa: true },
];

export const INITIAL_CENTROS_CUSTO: CentroCustoMaster[] = [
  { id: 'cc-1', codigo: 'CC-01', nome: 'Clínica / Atendimento', responsavel: 'Dra. Vanessa', ativo: true },
  { id: 'cc-2', codigo: 'CC-02', nome: 'Estoque Central', responsavel: 'Carlos Santos', ativo: true },
  { id: 'cc-3', codigo: 'CC-03', nome: 'Administrativo', responsavel: 'Ana Silva', ativo: true },
  { id: 'cc-4', codigo: 'CC-04', nome: 'Comercial & Marketing', responsavel: 'Juliana', ativo: true },
];

export const INITIAL_FORNECEDORES: FornecedorMaster[] = [
  { id: 'forn-1', nome: 'Allergan Produtos Farmacêuticos', cnpj: '43.214.567/0001-88', cidade: 'São Paulo/SP', tipo: 'FORNECEDOR', ativo: true },
  { id: 'forn-2', nome: 'Galderma Brasil Ltda', cnpj: '02.345.678/0001-12', cidade: 'São Paulo/SP', tipo: 'FORNECEDOR', ativo: true },
  { id: 'forn-3', nome: 'Imobiliária Paulista S/A', cnpj: '11.222.333/0001-00', cidade: 'São Paulo/SP', tipo: 'FORNECEDOR', ativo: true },
  { id: 'forn-4', nome: 'Enel Distribuição São Paulo', cnpj: '61.695.227/0001-93', cidade: 'São Paulo/SP', tipo: 'FORNECEDOR', ativo: true },
  { id: 'forn-5', nome: 'Juliana Mendes (Paciente)', cnpj: '123.456.789-00', cidade: 'São Paulo/SP', tipo: 'CLIENTE', ativo: true },
  { id: 'forn-6', nome: 'Roberto Fonseca (Paciente)', cnpj: '987.654.321-11', cidade: 'São Paulo/SP', tipo: 'CLIENTE', ativo: true }
];

export const INITIAL_BANCOS: BancoMaster[] = [
  { id: 'banc-1', banco: 'Itaú Uniclass - C/C 45892-1', agencia: '0892', conta: '45892-1', unidade: 'Royal Face - Matriz', saldo: 84520.00, ativo: true },
  { id: 'banc-2', banco: 'Bradesco - C/C 12904-8', agencia: '1209', conta: '12904-8', unidade: 'Royal Face - Matriz', saldo: 28100.00, ativo: true },
  { id: 'banc-3', banco: 'Caixa Físico Recepção', agencia: '0000', conta: 'CX-REC-01', unidade: 'Royal Face - Matriz', saldo: 1060.00, ativo: true },
  { id: 'banc-4', banco: 'Caixa Físico Recepção Centro', agencia: '0000', conta: 'CX-CEN-01', unidade: 'Royal Face - Unidade Centro', saldo: 0.00, ativo: true },
  { id: 'banc-5', banco: 'Caixa Físico Recepção Moema', agencia: '0000', conta: 'CX-MOE-01', unidade: 'Royal Face - Moema', saldo: 0.00, ativo: true },
  { id: 'banc-6', banco: 'Caixa Físico Recepção Jardins', agencia: '0000', conta: 'CX-JAR-01', unidade: 'Royal Face - Jardins', saldo: 0.00, ativo: true }
];

export const INITIAL_CONDICOES_PAGAMENTO: CondicaoPagamento[] = [
  { id: 'cond-1', nome: 'À Vista / PAGO (0 dias)', prazosDias: [0], ativa: true },
  { id: 'cond-2', nome: '15 Dias (1x)', prazosDias: [15], ativa: true },
  { id: 'cond-3', nome: '30 Dias (1x)', prazosDias: [30], ativa: true },
  { id: 'cond-4', nome: '30/60 Dias (2x)', prazosDias: [30, 60], ativa: true },
  { id: 'cond-5', nome: '30/60/90 Dias (3x)', prazosDias: [30, 60, 90], ativa: true },
  { id: 'cond-6', nome: '28/56/84 Dias (3x)', prazosDias: [28, 56, 84], ativa: true },
  { id: 'cond-7', nome: '15/30/45/60 Dias (4x)', prazosDias: [15, 30, 45, 60], ativa: true },
];

export const INITIAL_LANCAMENTOS: Lancamento[] = [
  // Receitas
  {
    id: 'rec-001',
    descricao: 'Aplicação de Toxina Botulínica - Paciente Juliana M.',
    tipo: 'RECEITA',
    categoria: 'Procedimentos Estéticos',
    centroCusto: 'Clínica / Atendimento',
    valor: 2450.00,
    dataVencimento: '2024-05-02',
    dataPagamento: '2024-05-02',
    status: 'PAGO',
    fornecedorCliente: 'Juliana Mendes',
    contaBancaria: 'Itaú Uniclass - C/C 45892-1',
    formaPagamento: 'CARTAO_CREDITO',
    unidade: 'Royal Face - Matriz',
    criadoEm: '2024-05-02'
  },
  {
    id: 'rec-002',
    descricao: 'Preenchimento Labial Ácido Hialurônico - Paciente Roberto F.',
    tipo: 'RECEITA',
    categoria: 'Procedimentos Estéticos',
    centroCusto: 'Clínica / Atendimento',
    valor: 1800.00,
    dataVencimento: '2024-05-05',
    dataPagamento: '2024-05-05',
    status: 'PAGO',
    fornecedorCliente: 'Roberto Fonseca',
    contaBancaria: 'Itaú Uniclass - C/C 45892-1',
    formaPagamento: 'PIX',
    unidade: 'Royal Face - Matriz',
    criadoEm: '2024-05-05'
  },
  {
    id: 'rec-003',
    descricao: 'Sessão Fios de Sustentação - Paciente Beatriz L.',
    tipo: 'RECEITA',
    categoria: 'Procedimentos Estéticos',
    centroCusto: 'Clínica / Atendimento',
    valor: 3200.00,
    dataVencimento: '2024-05-10',
    dataPagamento: '2024-05-10',
    status: 'PAGO',
    fornecedorCliente: 'Beatriz Lima',
    contaBancaria: 'Bradesco - C/C 12904-8',
    formaPagamento: 'CARTAO_CREDITO',
    unidade: 'Royal Face - Unidade Centro',
    criadoEm: '2024-05-10'
  },
  {
    id: 'rec-004',
    descricao: 'Pacote Harmonização Facial - Paciente Patricia R.',
    tipo: 'RECEITA',
    categoria: 'Procedimentos Estéticos',
    centroCusto: 'Clínica / Atendimento',
    valor: 4500.00,
    dataVencimento: '2024-05-18',
    status: 'PENDENTE',
    fornecedorCliente: 'Patricia Ramos',
    contaBancaria: 'Itaú Uniclass - C/C 45892-1',
    formaPagamento: 'BOLETO',
    unidade: 'Royal Face - Matriz',
    criadoEm: '2024-05-12'
  },
  {
    id: 'rec-005',
    descricao: 'Venda Dermocosméticos Home Care - Kit Pós-Procedimento',
    tipo: 'RECEITA',
    categoria: 'Venda de Produtos',
    centroCusto: 'Recepção / Dermocosméticos',
    valor: 680.00,
    dataVencimento: '2024-05-15',
    dataPagamento: '2024-05-15',
    status: 'PAGO',
    fornecedorCliente: 'Camila Torres',
    contaBancaria: 'Caixa Físico Recepção',
    formaPagamento: 'DINHEIRO',
    unidade: 'Royal Face - Matriz',
    criadoEm: '2024-05-15'
  },
  // Despesas
  {
    id: 'desp-101',
    descricao: 'Lote Toxina Botulínica 100U - Allergan Aesthetics',
    tipo: 'DESPESA',
    categoria: 'Insumos Médicos & Estéticos',
    centroCusto: 'Estoque Central',
    valor: 5400.00,
    dataVencimento: '2024-05-08',
    dataPagamento: '2024-05-08',
    status: 'PAGO',
    fornecedorCliente: 'Allergan Produtos Farmacêuticos',
    contaBancaria: 'Itaú Uniclass - C/C 45892-1',
    formaPagamento: 'TRANSFERENCIA',
    unidade: 'Royal Face - Matriz',
    comprovanteUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=300',
    criadoEm: '2024-05-01'
  },
  {
    id: 'desp-102',
    descricao: 'Aluguel Imóvel Comercial - Unidade Matriz',
    tipo: 'DESPESA',
    categoria: 'Aluguel, Condomínio & IPTU',
    centroCusto: 'Administrativo',
    valor: 12500.00,
    dataVencimento: '2024-05-10',
    dataPagamento: '2024-05-10',
    status: 'PAGO',
    fornecedorCliente: 'Imobiliária Paulista S/A',
    contaBancaria: 'Itaú Uniclass - C/C 45892-1',
    formaPagamento: 'BOLETO',
    unidade: 'Royal Face - Matriz',
    criadoEm: '2024-05-01'
  },
  {
    id: 'desp-103',
    descricao: 'Campanha Meta Ads (Instagram / Facebook Estética)',
    tipo: 'DESPESA',
    categoria: 'Marketing & Publicidade',
    centroCusto: 'Comercial',
    valor: 3800.00,
    dataVencimento: '2024-05-12',
    dataPagamento: '2024-05-12',
    status: 'PAGO',
    fornecedorCliente: 'Meta Platforms Ireland Ltd',
    contaBancaria: 'Itaú Uniclass - C/C 45892-1',
    formaPagamento: 'CARTAO_CREDITO',
    unidade: 'Royal Face - Matriz',
    criadoEm: '2024-05-05'
  },
  {
    id: 'desp-104',
    descricao: 'Energia Elétrica - Enel SP (Maio/2024)',
    tipo: 'DESPESA',
    categoria: 'Energia Elétrica',
    centroCusto: 'Administrativo',
    valor: 2150.80,
    dataVencimento: '2024-05-20',
    status: 'PENDENTE',
    fornecedorCliente: 'Enel Distribuição São Paulo',
    contaBancaria: 'Itaú Uniclass - C/C 45892-1',
    formaPagamento: 'BOLETO',
    unidade: 'Royal Face - Matriz',
    criadoEm: '2024-05-10'
  },
  {
    id: 'desp-105',
    descricao: 'Manutenção Preventiva Equipamento Ultrassom Microfocado',
    tipo: 'DESPESA',
    categoria: 'Manutenção & Equipamentos',
    centroCusto: 'Clínica / Atendimento',
    valor: 1850.00,
    dataVencimento: '2024-05-25',
    status: 'PENDENTE',
    fornecedorCliente: 'MedTech Assistência Técnica',
    contaBancaria: 'Bradesco - C/C 12904-8',
    formaPagamento: 'PIX',
    unidade: 'Royal Face - Unidade Centro',
    criadoEm: '2024-05-14'
  },
  {
    id: 'desp-106',
    descricao: 'Folha de Pagamento - Equipe Biomédicas & Recepção',
    tipo: 'DESPESA',
    categoria: 'Salários & Encargos Administrativos',
    centroCusto: 'Recursos Humanos',
    valor: 28400.00,
    dataVencimento: '2024-05-05',
    dataPagamento: '2024-05-05',
    status: 'PAGO',
    fornecedorCliente: 'Folha Geral de Pagamento',
    contaBancaria: 'Itaú Uniclass - C/C 45892-1',
    formaPagamento: 'TRANSFERENCIA',
    unidade: 'Royal Face - Matriz',
    criadoEm: '2024-05-01'
  }
];

export const INITIAL_PARCELAMENTOS: Parcelamento[] = [
  {
    id: 'parc-1',
    unidade: 'Royal Face - Matriz',
    bancoId: 'banc-1',
    contaBancaria: 'Itaú Uniclass - C/C 45892-1',
    titulo: 'Aparelho Lavieen Laser Thulium 1927nm',
    fornecedor: 'KLD Biosistemas Equipamentos',
    categoria: 'Investimento em Equipamentos (Capex)',
    centroCusto: 'Tecnologia & Equipamentos',
    valorTotal: 120000.00,
    numeroParcelas: 12,
    parcelasPagas: 4,
    valorParcela: 10000.00,
    dataInicio: '2024-02-10',
    status: 'EM_ANDAMENTO',
    cronograma: [
      { numero: 1, vencimento: '2024-02-10', valor: 10000.00, status: 'PAGO', dataPagamento: '2024-02-10', lancamentoId: 'parc-1-1' },
      { numero: 2, vencimento: '2024-03-10', valor: 10000.00, status: 'PAGO', dataPagamento: '2024-03-10', lancamentoId: 'parc-1-2' },
      { numero: 3, vencimento: '2024-04-10', valor: 10000.00, status: 'PAGO', dataPagamento: '2024-04-10', lancamentoId: 'parc-1-3' },
      { numero: 4, vencimento: '2024-05-10', valor: 10000.00, status: 'PAGO', dataPagamento: '2024-05-10', lancamentoId: 'parc-1-4' },
      { numero: 5, vencimento: '2024-06-10', valor: 10000.00, status: 'PENDENTE' },
      { numero: 6, vencimento: '2024-07-10', valor: 10000.00, status: 'PENDENTE' },
      { numero: 7, vencimento: '2024-08-10', valor: 10000.00, status: 'PENDENTE' },
      { numero: 8, vencimento: '2024-09-10', valor: 10000.00, status: 'PENDENTE' },
      { numero: 9, vencimento: '2024-10-10', valor: 10000.00, status: 'PENDENTE' },
      { numero: 10, vencimento: '2024-11-10', valor: 10000.00, status: 'PENDENTE' },
      { numero: 11, vencimento: '2024-12-10', valor: 10000.00, status: 'PENDENTE' },
      { numero: 12, vencimento: '2025-01-10', valor: 10000.00, status: 'PENDENTE' }
    ]
  },
  {
    id: 'parc-2',
    unidade: 'Royal Face - Unidade Centro',
    titulo: 'Reforma e Ambientação Recepção VIP',
    fornecedor: 'Arquitetura & Cenografia SP Ltda',
    categoria: 'Obras & Benfeitorias',
    centroCusto: 'Administrativo',
    valorTotal: 36000.00,
    numeroParcelas: 6,
    parcelasPagas: 2,
    valorParcela: 6000.00,
    dataInicio: '2024-04-05',
    status: 'EM_ANDAMENTO',
    cronograma: [
      { numero: 1, vencimento: '2024-04-05', valor: 6000.00, status: 'PAGO', dataPagamento: '2024-04-05' },
      { numero: 2, vencimento: '2024-05-05', valor: 6000.00, status: 'PAGO', dataPagamento: '2024-05-05' },
      { numero: 3, vencimento: '2024-06-05', valor: 6000.00, status: 'PENDENTE' },
      { numero: 4, vencimento: '2024-07-05', valor: 6000.00, status: 'PENDENTE' },
      { numero: 5, vencimento: '2024-08-05', valor: 6000.00, status: 'PENDENTE' },
      { numero: 6, vencimento: '2024-09-05', valor: 6000.00, status: 'PENDENTE' }
    ]
  }
];

export const INITIAL_DOCUMENTS_OCR: DocumentoOCR[] = [
  {
    id: 'ocr-101',
    nomeArquivo: 'NF_Galderma_Preenchedores_Restylane.pdf',
    tamanho: '1.2 MB',
    tipo: 'NFE',
    status: 'PENDENTE_REVISAO',
    confiancaOCR: 96,
    dataUpload: '2024-05-18 10:14:00',
    dadosExtraidos: {
      fornecedor: 'Galderma Brasil Ltda',
      cnpj: '02.345.678/0001-12',
      dataEmissao: '2024-05-15',
      dataVencimento: '2024-05-28',
      valorTotal: 8450.00,
      categoria: 'Insumos Médicos & Estéticos',
      centroCusto: 'Estoque Central',
      itens: [
        { descricao: 'Restylane Lidocaine 1ml (Caixa c/ 2)', quantidade: 5, valorUnitario: 890.00, valorTotal: 4450.00 },
        { descricao: 'Dysport 500U Frasco Ampola', quantidade: 4, valorUnitario: 1000.00, valorTotal: 4000.00 }
      ]
    },
    previewUrl: 'https://images.unsplash.com/photo-1568667256549-094345857637?w=600'
  },
  {
    id: 'ocr-102',
    nomeArquivo: 'Recibo_Lavanderia_Jalecos_Maio.pdf',
    tamanho: '450 KB',
    tipo: 'RECIBO',
    status: 'PENDENTE_REVISAO',
    confiancaOCR: 78,
    dataUpload: '2024-05-18 11:30:00',
    dadosExtraidos: {
      fornecedor: 'Lavanderia Higiene & Saude Eireli',
      cnpj: '11.890.123/0001-44',
      dataEmissao: '2024-05-17',
      dataVencimento: '2024-05-24',
      valorTotal: 340.00,
      categoria: 'Serviços Terceirizados',
      centroCusto: 'Clínica / Atendimento'
    },
    previewUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600'
  }
];

export const INITIAL_SESSAO_CAIXA: SessaoCaixaFisico = {
  id: 'caixa-fisico-continuo',
  movimentacoes: [
    {
      id: 'mov-1',
      tipo: 'AJUSTE',
      descricao: 'Definição do saldo inicial do caixa físico',
      valor: 500.00,
      dataHora: '2024-05-18 08:00:00',
      usuario: 'Carlos Eduardo Santos',
      unidade: 'Royal Face - Matriz',
      sentido: 'ENTRADA',
      saldoApos: 500.00,
      motivoAjuste: 'Implantação do controle contínuo de numerário',
      finalidade: 'AJUSTE_SALDO',
      impactoDRE: 'NAO_AFETA',
      statusConciliacao: 'CONCILIADO'
    },
    {
      id: 'mov-2',
      tipo: 'VENDA',
      descricao: 'Venda Kit Dermocosméticos Home Care - Cliente Camila T.',
      valor: 680.00,
      dataHora: '2024-05-18 11:20:00',
      usuario: 'Carlos Eduardo Santos',
      unidade: 'Royal Face - Matriz',
      sentido: 'ENTRADA',
      saldoApos: 1180.00,
      finalidade: 'VENDA_DINHEIRO',
      impactoDRE: 'RECEITA',
      statusConciliacao: 'CONCILIADO'
    },
    {
      id: 'mov-3',
      tipo: 'SANGRIA',
      descricao: 'Pagamento Motoboy Entrega Urgente Insumos',
      valor: 120.00,
      dataHora: '2024-05-18 13:45:00',
      usuario: 'Carlos Eduardo Santos',
      unidade: 'Royal Face - Matriz',
      sentido: 'SAIDA',
      saldoApos: 1060.00,
      finalidade: 'PAGAMENTO_DESPESA',
      impactoDRE: 'NAO_AFETA',
      statusConciliacao: 'CONCILIADO',
      comprovanteRef: 'Recibo Motoboy #9082'
    }
  ]
};

export const INITIAL_FECHAMENTO: FechamentoMensal = {
  mesAno: '2024-05',
  status: 'EM_REVISAO',
  checklist: [
    { id: 'chk-1', item: 'Conciliação Bancária de todas as contas 100% efetuada', concluido: true, responsavel: 'Carlos Eduardo' },
    { id: 'chk-2', item: 'Conferência de Caixa Físico e sangrias validada', concluido: true, responsavel: 'Carlos Eduardo' },
    { id: 'chk-3', item: 'Aprovação de todos os documentos da fila OCR', concluido: false, responsavel: 'Ana Claudia' },
    { id: 'chk-5', item: 'Conferência de impostos e tributos apurados (DAS/PIS/COFINS)', concluido: false, responsavel: 'Ana Claudia' }
  ],
  observacoes: 'Mês com excelente volume de vendas de harmonização. Aguardando aprovação final dos dois últimos documentos do OCR para travar o período.'
};

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-1',
    dataHora: '2024-05-18 14:10:05',
    usuario: 'Ana Claudia Silva',
    acao: 'APROVACAO',
    modulo: 'Documentos OCR',
    descricao: 'Aprovou o documento NF_Allergan_Toxina.pdf no valor de R$ 5.400,00',
    valorAnterior: 'Status: PENDENTE_REVISAO',
    valorNovo: 'Status: APROVADO',
    ip: '189.120.45.12'
  },
  {
    id: 'log-2',
    dataHora: '2024-05-18 11:20:12',
    usuario: 'Carlos Eduardo Santos',
    acao: 'CRIACAO',
    modulo: 'Caixa Físico',
    descricao: 'Registrou venda em dinheiro no valor de R$ 680,00',
    valorNovo: 'R$ 680,00 - Kit Dermocosméticos Home Care',
    ip: '189.120.45.14'
  },
  {
    id: 'log-3',
    dataHora: '2024-05-17 16:30:00',
    usuario: 'Mariana Oliveira',
    acao: 'EDICAO',
    modulo: 'Conciliação Bancária',
    descricao: 'Manual Match efetuado no lançamento rec-001 de R$ 2.450,00 com Extrato PIX984210',
    valorAnterior: 'Conciliado: false',
    valorNovo: 'Conciliado: true',
    ip: '177.40.12.99'
  }
];

export const INITIAL_AUTOMATIONS: RegraAutomacao[] = [
  {
    id: 'aut-1',
    nome: 'Auto Categorizar Insumos Allergan',
    palavraChave: 'ALLERGAN',
    categoriaDestino: 'Insumos Médicos & Estéticos',
    centroCustoDestino: 'Estoque Central',
    autoAprovarConfiancaMinima: 90,
    ativa: true
  },
  {
    id: 'aut-2',
    nome: 'Auto Categorizar Aluguel Imobiliária',
    palavraChave: 'IMOBILIARIA PAULISTA',
    categoriaDestino: 'Aluguel, Condomínio & IPTU',
    centroCustoDestino: 'Administrativo',
    autoAprovarConfiancaMinima: 95,
    ativa: true
  },
  {
    id: 'aut-3',
    nome: 'Concessionária Energia Enel',
    palavraChave: 'ENEL',
    categoriaDestino: 'Energia Elétrica',
    centroCustoDestino: 'Administrativo',
    autoAprovarConfiancaMinima: 85,
    ativa: true
  }
];

export const INITIAL_DRE: DREItem[] = [
  { codigo: '1', descricao: 'RECEITA BRUTA DE VENDAS E SERVIÇOS', tipo: 'TOTAL', nivel: 1, mesAtual: 0, mesAnterior: 0, orcado: 135000.00 },
  { codigo: '2', descricao: '(-) DEDUÇÕES DA RECEITA BRUTA', tipo: 'SUBTOTAL', nivel: 1, mesAtual: 0, mesAnterior: 0, orcado: -8100.00 },
  { codigo: '3', descricao: '(=) RECEITA LÍQUIDA OPERACIONAL', tipo: 'TOTAL', nivel: 1, mesAtual: 0, mesAnterior: 0, orcado: 126900.00 },
  { codigo: '4', descricao: '(-) CUSTOS DOS PRODUTOS E SERVIÇOS (CPV/CSP)', tipo: 'SUBTOTAL', nivel: 1, mesAtual: 0, mesAnterior: 0, orcado: -36000.00 },
  { codigo: '5', descricao: '(=) LUCRO BRUTO OPERACIONAL', tipo: 'TOTAL', nivel: 1, mesAtual: 0, mesAnterior: 0, orcado: 90900.00 },
  { codigo: '6', descricao: '(-) DESPESAS COM VENDAS', tipo: 'SUBTOTAL', nivel: 1, mesAtual: 0, mesAnterior: 0, orcado: -8000.00 },
  { codigo: '7', descricao: '(-) DESPESAS ADMINISTRATIVAS', tipo: 'SUBTOTAL', nivel: 1, mesAtual: 0, mesAnterior: 0, orcado: -40500.00 },
  { codigo: '8', descricao: '(+/-) OUTRAS RECEITAS E DESPESAS OPERACIONAIS', tipo: 'SUBTOTAL', nivel: 1, mesAtual: 0, mesAnterior: 0, orcado: 0 },
  { codigo: '9', descricao: '(=) EBITDA', tipo: 'TOTAL', nivel: 1, mesAtual: 0, mesAnterior: 0, orcado: 42400.00 },
  { codigo: '10', descricao: '(-) DEPRECIAÇÃO E AMORTIZAÇÃO', tipo: 'SUBTOTAL', nivel: 1, mesAtual: 0, mesAnterior: 0, orcado: -2000.00 },
  { codigo: '11', descricao: '(=) RESULTADO OPERACIONAL (EBIT)', tipo: 'TOTAL', nivel: 1, mesAtual: 0, mesAnterior: 0, orcado: 40400.00 },
  { codigo: '12', descricao: '(+/-) RESULTADO FINANCEIRO', tipo: 'SUBTOTAL', nivel: 1, mesAtual: 0, mesAnterior: 0, orcado: -1200.00 },
  { codigo: '13', descricao: '(=) RESULTADO ANTES DOS TRIBUTOS SOBRE O LUCRO', tipo: 'TOTAL', nivel: 1, mesAtual: 0, mesAnterior: 0, orcado: 39200.00 },
  { codigo: '14', descricao: '(-) IRPJ E CSLL', tipo: 'SUBTOTAL', nivel: 1, mesAtual: 0, mesAnterior: 0, orcado: 0 },
  { codigo: '15', descricao: '(=) LUCRO OU PREJUÍZO LÍQUIDO DO PERÍODO', tipo: 'TOTAL', nivel: 1, mesAtual: 0, mesAnterior: 0, orcado: 39200.00 }
];
