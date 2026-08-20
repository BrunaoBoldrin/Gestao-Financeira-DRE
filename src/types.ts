export type UserRole = 'ADMIN' | 'FINANCE' | 'AUDITOR';

export type ViewKey =
  | 'overview'
  | 'inbox'
  | 'pending_review'
  | 'receitas'
  | 'despesas'
  | 'parcelamentos'
  | 'caixa_fisico'
  | 'fluxo_caixa'
  | 'dre'
  | 'documentos'
  | 'fechamento'
  | 'cadastros'
  | 'import_excel'
  | 'automacoes'
  | 'historico'
  | 'usuarios'
  | 'configuracoes';

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
export type GrupoDRE =
  | 'RECEITA_BRUTA'
  | 'DEDUCAO_RECEITA'
  | 'CUSTO_SERVICO_PRODUTO'
  | 'DESPESA_VENDAS'
  | 'DESPESA_ADMINISTRATIVA'
  | 'OUTRA_RECEITA_OPERACIONAL'
  | 'OUTRA_DESPESA_OPERACIONAL'
  | 'DEPRECIACAO_AMORTIZACAO'
  | 'RECEITA_FINANCEIRA'
  | 'DESPESA_FINANCEIRA'
  | 'TRIBUTO_LUCRO'
  | 'NAO_AFETA_DRE';
export type SentidoFinanceiro = 'ENTRADA' | 'SAIDA' | 'A_CONFIRMAR';
export type ImpactoDRE = 'RECEITA' | 'DESPESA' | 'NAO_AFETA' | 'A_CONFIRMAR';
export type FinalidadeFinanceira =
  | 'RECEBIMENTO_CLIENTE'
  | 'PAGAMENTO_FORNECEDOR'
  | 'TRANSFERENCIA_INTERNA'
  | 'EMPRESTIMO'
  | 'APORTE_SOCIO'
  | 'RETIRADA_SOCIO'
  | 'ESTORNO_DEVOLUCAO'
  | 'TARIFA_BANCARIA'
  | 'ADIANTAMENTO_CLIENTE'
  | 'OUTRO'
  | 'A_CONFIRMAR';
export type TipoDocumentoOCR =
  | 'NFE'
  | 'NFSE'
  | 'RECIBO'
  | 'COMPROVANTE'
  | 'BOLETO'
  | 'DDA'
  | 'FATURA'
  | 'EXTRATO'
  | 'PDF_MISTO'
  | 'OUTRO';

export interface Lancamento {
  id: string;
  descricao: string;
  tipo: TipoLancamento;
  categoria: string;
  centroCusto: string;
  valor: number;
  dataCompetencia?: string;
  dataVencimento: string;
  dataPagamento?: string;
  status: StatusLancamento;
  fornecedorCliente: string;
  contaBancaria: string;
  bancoId?: string;
  comprovanteUrl?: string;
  documentoRef?: string;
  cpfCnpjContraparte?: string;
  linhaDigitavel?: string;
  chaveDocumento?: string;
  identificadorTransacao?: string;
  impactoDRE?: Exclude<ImpactoDRE, 'A_CONFIRMAR'>;
  finalidadeFinanceira?: Exclude<FinalidadeFinanceira, 'A_CONFIRMAR'>;
  documentoConciliadoId?: string;
  parcelamentoId?: string;
  numeroParcela?: string;
  formaPagamento: 'PIX' | 'BOLETO' | 'CARNE' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'DINHEIRO' | 'TRANSFERENCIA';
  unidade: string;
  observacoes?: string;
  criadoEm: string;
}

export interface DadosLiquidacao {
  bancoId: string;
  formaPagamento: Lancamento['formaPagamento'];
  dataPagamento: string;
}

export interface Parcelamento {
  id: string;
  unidade: string;
  bancoId?: string;
  contaBancaria?: string;
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
    bancoId?: string;
    contaBancaria?: string;
    formaPagamento?: Lancamento['formaPagamento'];
  }[];
}

export interface DocumentoOCR {
  id: string;
  nomeArquivo: string;
  tamanho: string;
  tipo: TipoDocumentoOCR;
  status: 'PROCESSANDO' | 'PENDENTE_REVISAO' | 'APROVADO' | 'REJEITADO';
  confiancaOCR: number; // 0 a 100
  dataUpload: string;
  dadosExtraidos: {
    fornecedor: string;
    cnpj: string;
    dataEmissao: string;
    dataCompetencia?: string;
    dataVencimento: string;
    valorTotal: number;
    categoria: string;
    centroCusto: string;
    observacoes?: string;
    pagador?: string;
    recebedor?: string;
    documentoNumero?: string;
    linhaDigitavel?: string;
    chaveDocumento?: string;
    identificadorTransacao?: string;
    sentidoSugerido?: SentidoFinanceiro;
    impactoDRESugerido?: ImpactoDRE;
    finalidadeSugerida?: FinalidadeFinanceira;
    parcelaNumero?: string;
    paginaOrigem?: number;
    itens?: { descricao: string; quantidade: number; valorUnitario: number; valorTotal: number }[];
  };
  previewUrl: string;
  previewMimeType?: string;
  hashArquivo?: string;
  entidadeNumero?: number;
  totalEntidadesDocumento?: number;
  documentoOrigemId?: string;
  lancamentoGeradoId?: string;
}

export type FinalidadeMovimentacaoCaixa =
  | 'AJUSTE_SALDO'
  | 'REFORCO_TROCO'
  | 'DEPOSITO_BANCARIO'
  | 'TRANSFERENCIA_COFRE'
  | 'PAGAMENTO_DESPESA'
  | 'RETIRADA_SOCIO'
  | 'VENDA_DINHEIRO'
  | 'OUTRO';

export interface MovimentacaoCaixaFisico {
  id: string;
  tipo: 'AJUSTE' | 'SUPRIMENTO' | 'SANGRIA' | 'VENDA' | 'DESPESA';
  descricao: string;
  valor: number;
  dataHora: string;
  usuario: string;
  unidade: string;
  sentido: 'ENTRADA' | 'SAIDA';
  saldoApos?: number;
  motivoAjuste?: string;
  comprovanteRef?: string;
  finalidade?: FinalidadeMovimentacaoCaixa;
  impactoDRE?: Exclude<ImpactoDRE, 'A_CONFIRMAR'>;
  statusConciliacao?: 'PENDENTE' | 'EM_TRANSITO' | 'CONCILIADO';
  bancoOrigemId?: string;
  bancoDestinoId?: string;
  lancamentoRelacionadoId?: string;
  observacoes?: string;
}

export interface DetalhesMovimentacaoCaixa {
  finalidade: FinalidadeMovimentacaoCaixa;
  impactoDRE: Exclude<ImpactoDRE, 'A_CONFIRMAR'>;
  statusConciliacao: 'PENDENTE' | 'EM_TRANSITO' | 'CONCILIADO';
  bancoOrigemId?: string;
  bancoDestinoId?: string;
  lancamentoRelacionadoId?: string;
  observacoes?: string;
  unidade?: string;
}

export interface SessaoCaixaFisico {
  id: string;
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
  grupoDRE: GrupoDRE;
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
  unidade: string;
  saldo: number;
  ativo: boolean;
}

export interface CondicaoPagamento {
  id: string;
  nome: string;
  prazosDias: number[];
  ativa: boolean;
}
