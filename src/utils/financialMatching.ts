import { DocumentoOCR, Lancamento } from '../types';

export type NivelCorrespondencia = 'DUPLICIDADE_FORTE' | 'CORRESPONDENCIA_PROVAVEL' | 'COINCIDENCIA_VALOR';

export interface CorrespondenciaFinanceira {
  lancamento: Lancamento;
  nivel: NivelCorrespondencia;
  pontuacao: number;
  motivos: string[];
}

const normalizeText = (value?: string) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();

// Identificadores Pix (EndToEnd/TxId) são alfanuméricos. Remover as letras
// poderia transformar IDs diferentes em uma falsa duplicidade forte.
const normalizeIdentifier = (value?: string) => normalizeText(value);

const dateDistanceInDays = (first?: string, second?: string) => {
  if (!first || !second) return Number.POSITIVE_INFINITY;
  const firstDate = new Date(`${first.substring(0, 10)}T12:00:00`).getTime();
  const secondDate = new Date(`${second.substring(0, 10)}T12:00:00`).getTime();
  if (!Number.isFinite(firstDate) || !Number.isFinite(secondDate)) return Number.POSITIVE_INFINITY;
  return Math.abs(firstDate - secondDate) / 86_400_000;
};

const sameNonEmpty = (left?: string, right?: string) => {
  const normalizedLeft = normalizeText(left);
  const normalizedRight = normalizeText(right);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
};

const sameIdentifier = (left?: string, right?: string) => {
  const normalizedLeft = normalizeIdentifier(left);
  const normalizedRight = normalizeIdentifier(right);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
};

export const findFinancialMatches = (
  documento: DocumentoOCR,
  lancamentos: Lancamento[]
): CorrespondenciaFinanceira[] => {
  const dados = documento.dadosExtraidos;

  return lancamentos
    .map((lancamento): CorrespondenciaFinanceira | null => {
      const motivos: string[] = [];
      let pontuacao = 0;
      let identificadorForte = false;

      const strongIdentifiers = [
        [dados.linhaDigitavel, lancamento.linhaDigitavel, 'mesma linha digitável'],
        [dados.chaveDocumento, lancamento.chaveDocumento, 'mesma chave do documento fiscal'],
        [dados.identificadorTransacao, lancamento.identificadorTransacao, 'mesmo identificador da transação']
      ] as const;

      strongIdentifiers.forEach(([left, right, reason]) => {
        if (sameIdentifier(left, right)) {
          identificadorForte = true;
          pontuacao += 100;
          motivos.push(reason);
        }
      });

      const sameAmount = Math.abs((dados.valorTotal || 0) - lancamento.valor) <= 0.01 && dados.valorTotal > 0;
      if (!sameAmount && !identificadorForte) return null;
      if (sameAmount) {
        pontuacao += 25;
        motivos.push('mesmo valor');
      }

      if (sameIdentifier(dados.cnpj, lancamento.cpfCnpjContraparte)) {
        pontuacao += 35;
        motivos.push('mesmo CPF/CNPJ');
      }

      const counterparty = dados.recebedor || dados.pagador || dados.fornecedor;
      if (sameNonEmpty(counterparty, lancamento.fornecedorCliente)) {
        pontuacao += 25;
        motivos.push('mesmo cliente/fornecedor');
      }

      const distance = Math.min(
        dateDistanceInDays(dados.dataVencimento, lancamento.dataVencimento),
        dateDistanceInDays(dados.dataEmissao, lancamento.dataPagamento || lancamento.dataVencimento)
      );
      if (distance <= 2) {
        pontuacao += 20;
        motivos.push('data igual ou muito próxima');
      } else if (distance <= 15) {
        pontuacao += 10;
        motivos.push('data próxima');
      }

      const nivel: NivelCorrespondencia = identificadorForte
        ? 'DUPLICIDADE_FORTE'
        : pontuacao >= 60
          ? 'CORRESPONDENCIA_PROVAVEL'
          : 'COINCIDENCIA_VALOR';

      return { lancamento, nivel, pontuacao, motivos };
    })
    .filter((match): match is CorrespondenciaFinanceira => Boolean(match))
    .sort((left, right) => right.pontuacao - left.pontuacao);
};

export const findDuplicateDocumentByHash = (
  documento: DocumentoOCR,
  documentos: DocumentoOCR[]
) => documentos.find(
  (candidate) => {
    const currentOrigin = documento.documentoOrigemId || documento.id;
    const candidateOrigin = candidate.documentoOrigemId || candidate.id;
    return candidate.id !== documento.id &&
      currentOrigin !== candidateOrigin &&
      Boolean(documento.hashArquivo) &&
      documento.hashArquivo === candidate.hashArquivo &&
      candidate.status !== 'REJEITADO';
  }
  );
