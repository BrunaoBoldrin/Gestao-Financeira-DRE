export type UserRole = 'ADMIN' | 'FINANCE' | 'AUDITOR';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  unit: string;
  active: boolean;
  lastAccess: string;
}

export type StatusLancamento = 'PAGO' | 'PENDENTE' | 'ATRASADO' | 'CANCELADO';
export type TipoLancamento = 'RECEITA' | 'DESPESA';

export interface Lancamento {
  id: string;
  descricao: string;
  tipo: TipoLancamento;
  categoria: string;
  centroCusto: string;
  valor: number;
  dataVencimento: string;
  dataPagamento?: string;
  status: StatusLancamento;
  fornecedorCliente: string;
  contaBancaria: string;
  comprovanteUrl?: string;
  documentoRef?: string;
  parcelamentoId?: string;
  numeroParcela?: string;
  formaPagamento: 'PIX' | 'BOLETO' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'DINHEIRO' | 'TRANSFERENCIA';
  unidade: string;
  observacoes?: string;
  criadoEm: string;
}

export interface Parcelamento {
  id: string;
  titulo: string;
  fornecedor: string;
  categoria: string;
  centroCusto: string;
  valorTotal: number;
  numeroParcelas: number;
  parcelasPagas: number;
  valorParcela: number;
  dataInicio: string;
  status: 'EM_ANDAMENTO' | 'CONCLUIDO' | 'CANCELADO';
  cronograma: {
    numero: number;
    vencimento: string;
    valor: number;
    status: StatusLancamento;
    dataPagamento?: string;
    lancamentoId?: string;
  }[];
}

export interface DocumentoOCR {
  id: string;
  nomeArquivo: string;
  tamanho: string;
  tipo: 'NFE' | 'RECIBO' | 'BOLETO' | 'FATURA' | 'OUTRO';
  status: 'PROCESSANDO' | 'PENDENTE_REVISAO' | 'APROVADO' | 'REJEITADO';
  confiancaOCR: number; // 0 a 100
  dataUpload: string;
  dadosExtraidos: {
    fornecedor: string;
    cnpj: string;
    dataEmissao: string;
    dataVencimento: string;
    valorTotal: number;
    categoria: string;
    centroCusto: string;
    observacoes?: string;
    itens?: { descricao: string; quantidade: number; valorUnitario: number; valorTotal: number }[];
  };
  previewUrl: string;
  lancamentoGeradoId?: string;
}

export interface MovimentacaoCaixaFisico {
  id: string;
  tipo: 'SUPRIMENTO' | 'SANGRIA' | 'VENDA' | 'DESPESA';
  descricao: string;
  valor: number;
  dataHora: string;
  usuario: string;
  comprovanteRef?: string;
}

export interface SessaoCaixaFisico {
  id: string;
  data: string;
  status: 'ABERTO' | 'FECHADO';
  saldoInicial: number;
  entradasDinheiro: number;
  saidasDinheiro: number;
  saldoEsperado: number;
  saldoContado?: number;
  divergencia?: number;
  observacaoFechamento?: string;
  operadorAbertura: string;
  operadorFechamento?: string;
  movimentacoes: MovimentacaoCaixaFisico[];
}

export interface FechamentoMensal {
  mesAno: string; // "2024-05"
  status: 'ABERTO' | 'EM_REVISAO' | 'FECHADO';
  dataFechamento?: string;
  fechadoPor?: string;
  checklist: {
    id: string;
    item: string;
    concluido: boolean;
    responsavel?: string;
  }[];
  provisoesDepreciacao: {
    descricao: string;
    categoria: string;
    valor: number;
  }[];
  observacoes?: string;
}

export interface AuditLog {
  id: string;
  dataHora: string;
  usuario: string;
  acao: 'CRIACAO' | 'EDICAO' | 'EXCLUSAO' | 'APROVACAO' | 'CONCILIACAO' | 'FECHAMENTO';
  modulo: string;
  descricao: string;
  valorAnterior?: string;
  valorNovo?: string;
  ip: string;
}

export interface RegraAutomacao {
  id: string;
  nome: string;
  palavraChave: string;
  categoriaDestino: string;
  centroCustoDestino: string;
  autoAprovarConfiancaMinima: number;
  ativa: boolean;
}

export interface DREItem {
  codigo: string;
  descricao: string;
  tipo: 'TITULO' | 'CONTA' | 'SUBTOTAL' | 'TOTAL';
  nivel: number;
  mesAtual: number;
  mesAnterior: number;
  orcado: number;
  filhos?: DREItem[];
}

export interface UnitConfig {
  id: string;
  nome: string;
  cnpj: string;
  razaoSocial: string;
  cidade: string;
  ativa: boolean;
}

export interface CategoriaMaster {
  id: string;
  codigo: string;
  nome: string;
  tipo: 'RECEITA' | 'DESPESA';
  ativa: boolean;
}

export interface CentroCustoMaster {
  id: string;
  codigo: string;
  nome: string;
  responsavel: string;
  ativo: boolean;
}

export interface FornecedorMaster {
  id: string;
  nome: string;
  cnpj: string;
  cidade: string;
  tipo: 'FORNECEDOR' | 'CLIENTE';
  ativo: boolean;
}

export interface BancoMaster {
  id: string;
  banco: string;
  agencia: string;
  conta: string;
  saldo: number;
  ativo: boolean;
}

export interface CondicaoPagamento {
  id: string;
  nome: string;
  prazosDias: number[];
  ativa: boolean;
}
