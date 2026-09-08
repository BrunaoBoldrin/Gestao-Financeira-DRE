import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import * as XLSX from 'xlsx';
import { Lancamento, TipoLancamento, StatusLancamento } from '../../types';
import { SortableTableHeader } from '../common/SortableTableHeader';
import { useSortableData } from '../../hooks/useSortableData';

interface ColumnMapping {
  descricao: string;
  tipo: string;
  valor: string;
  dataEmissao: string;
  dataCompetencia: string;
  dataVencimento: string;
  categoria: string;
  centroCusto: string;
  fornecedorCliente: string;
  contaBancaria: string;
  formaPagamento: string;
  unidade: string;
  condicaoDDL: string;
  status: string;
  dataPagamento: string;
  cpfCnpj: string;
  documentoRef: string;
  observacoes: string;
}

const normalizeDateParts = (year: number, month: number, day: number) => {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) return '';
  if (!Number.isInteger(month) || !Number.isInteger(day)) return '';

  const parsedDate = new Date(year, month - 1, day, 12);
  if (
    parsedDate.getFullYear() !== year
    || parsedDate.getMonth() !== month - 1
    || parsedDate.getDate() !== day
  ) return '';

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const toDateValue = (date: Date) =>
  normalizeDateParts(date.getFullYear(), date.getMonth() + 1, date.getDate());

const toTemplateDateValue = (date: Date) =>
  `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;

const toDisplayDateValue = (isoDate?: string) => {
  const match = isoDate?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : isoDate || '—';
};

const parseImportDate = (rawDate: unknown, fallback = '') => {
  if (rawDate instanceof Date && !Number.isNaN(rawDate.getTime())) return toDateValue(rawDate);

  if (typeof rawDate === 'number' && Number.isFinite(rawDate)) {
    const parsedExcelDate = XLSX.SSF.parse_date_code(rawDate);
    if (parsedExcelDate) {
      return normalizeDateParts(parsedExcelDate.y, parsedExcelDate.m, parsedExcelDate.d) || fallback;
    }
  }

  if (typeof rawDate === 'string' && rawDate.trim()) {
    const value = rawDate.trim();

    const isoMatch = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
    if (isoMatch) {
      return normalizeDateParts(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3])) || fallback;
    }

    const brazilianMatch = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})(?:[T\s].*)?$/);
    if (brazilianMatch) {
      const year = brazilianMatch[3].length === 2
        ? Number(`20${brazilianMatch[3]}`)
        : Number(brazilianMatch[3]);
      return normalizeDateParts(year, Number(brazilianMatch[2]), Number(brazilianMatch[1])) || fallback;
    }
  }

  return fallback;
};

const normalizeLookupText = (value: string) =>
  value
    .normalize('NFKC')
    .replace(/[‐‑‒–—−/]+/g, '-')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pt-BR');

const IMPORT_TEMPLATE_HEADERS = [
  'Descrição',
  'Tipo (RECEITA ou DESPESA)',
  'Valor (R$)',
  'Data Emissão (DD-MM-AAAA)',
  'Data Competência DRE (DD-MM-AAAA)',
  'Data Vencimento / 1º Vencimento (DD-MM-AAAA)',
  'Categoria DRE',
  'Centro de Custo',
  'Fornecedor / Cliente',
  'Conta Bancária',
  'Forma de Pagamento',
  'Unidade / Filial',
  'Condição DDL (Ex: 30/60/90 Dias)',
  'Status (PAGO, PENDENTE, ATRASADO ou CANCELADO)',
  'Data Pagamento (DD-MM-AAAA)',
  'CPF/CNPJ Contraparte',
  'Documento / Referência',
  'Observações'
];

const IMPORT_TEMPLATE_COLUMN_WIDTHS = [
  42, 28, 14, 25, 33, 45, 34, 28, 34, 34, 24, 28, 38, 48, 28, 24, 30, 44
];

const applyTemplateSheetLayout = (
  worksheet: XLSX.WorkSheet,
  columnWidths: number[],
  autoFilter = true
) => {
  worksheet['!cols'] = columnWidths.map((wch) => ({ wch }));
  if (autoFilter && worksheet['!ref']) worksheet['!autofilter'] = { ref: worksheet['!ref'] };
};

export const ImportExcelView: React.FC = () => {
  const {
    addLancamento,
    addLancamentoComDDL,
    condicoesPagamento,
    units,
    categorias,
    centrosCusto,
    fornecedores,
    bancos,
    flushPersistence,
    addAuditLog,
    setCurrentView,
    showToast,
    currentUser,
    isFinance
  } = useApp();

  const [rawRows, setRawRows] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload');
  const [isProcessing, setIsProcessing] = useState(false);

  // Column Mappings
  const [mapping, setMapping] = useState<ColumnMapping>({
    descricao: '',
    tipo: '',
    valor: '',
    dataEmissao: '',
    dataCompetencia: '',
    dataVencimento: '',
    categoria: '',
    centroCusto: '',
    fornecedorCliente: '',
    contaBancaria: '',
    formaPagamento: '',
    unidade: '',
    condicaoDDL: '',
    status: '',
    dataPagamento: '',
    cpfCnpj: '',
    documentoRef: '',
    observacoes: ''
  });

  // Excel import template generator
  const handleDownloadTemplate = () => {
    const activeUnits = units.filter((item) => item.ativa && item.id !== 'all');
    const activeCategories = categorias.filter((item) => item.ativa);
    const activeCostCenters = centrosCusto.filter((item) => item.ativo);
    const activeSuppliers = fornecedores.filter((item) => item.ativo);
    const activeBanks = bancos.filter((item) => item.ativo);
    const activePaymentTerms = condicoesPagamento.filter((item) => item.ativa);

    const sampleUnit = activeUnits[0]?.nome || '[CADASTRE UMA FILIAL]';
    const sampleExpenseCategory = activeCategories.find((item) => item.tipo === 'DESPESA')?.nome
      || '[CADASTRE UMA CATEGORIA DE DESPESA]';
    const sampleRevenueCategory = activeCategories.find((item) => item.tipo === 'RECEITA')?.nome
      || '[CADASTRE UMA CATEGORIA DE RECEITA]';
    const sampleCostCenter = activeCostCenters[0]?.nome || '[CADASTRE UM CENTRO DE CUSTO]';
    const sampleSupplier = activeSuppliers.find((item) => item.tipo === 'FORNECEDOR');
    const sampleClient = activeSuppliers.find((item) => item.tipo === 'CLIENTE');
    const sampleBank = activeBanks.find((item) => normalizeLookupText(item.unidade) === normalizeLookupText(sampleUnit));
    const sampleInstallmentTerm = activePaymentTerms.find((item) => item.prazosDias.length > 1);
    const sampleCashTerm = activePaymentTerms.find((item) => item.prazosDias.length === 1 && item.prazosDias[0] === 0);
    const issueDate = new Date();
    const firstDueDate = new Date(issueDate);
    firstDueDate.setDate(firstDueDate.getDate() + (sampleInstallmentTerm?.prazosDias[0] || 30));
    const issueDateText = toTemplateDateValue(issueDate);
    const firstDueDateText = toTemplateDateValue(firstDueDate);

    const sampleData: Array<Record<string, string | number>> = [
      {
        'Descrição': 'EXEMPLO — compra de insumos',
        'Tipo (RECEITA ou DESPESA)': 'DESPESA',
        'Valor (R$)': 4500,
        'Data Emissão (DD-MM-AAAA)': issueDateText,
        'Data Competência DRE (DD-MM-AAAA)': issueDateText,
        'Data Vencimento / 1º Vencimento (DD-MM-AAAA)': firstDueDateText,
        'Categoria DRE': sampleExpenseCategory,
        'Centro de Custo': sampleCostCenter,
        'Fornecedor / Cliente': sampleSupplier?.nome || 'Fornecedor do exemplo',
        'Conta Bancária': '',
        'Forma de Pagamento': 'BOLETO',
        'Unidade / Filial': sampleUnit,
        'Condição DDL (Ex: 30/60/90 Dias)': sampleInstallmentTerm?.nome || '30/60/90',
        'Status (PAGO, PENDENTE, ATRASADO ou CANCELADO)': 'PENDENTE',
        'Data Pagamento (DD-MM-AAAA)': '',
        'CPF/CNPJ Contraparte': sampleSupplier?.cnpj || '',
        'Documento / Referência': 'NF 0001',
        'Observações': 'Conta bancária e data de pagamento ficam vazias enquanto estiver pendente.'
      },
      {
        'Descrição': 'EXEMPLO — recebimento de cliente',
        'Tipo (RECEITA ou DESPESA)': 'RECEITA',
        'Valor (R$)': 3800,
        'Data Emissão (DD-MM-AAAA)': issueDateText,
        'Data Competência DRE (DD-MM-AAAA)': '',
        'Data Vencimento / 1º Vencimento (DD-MM-AAAA)': issueDateText,
        'Categoria DRE': sampleRevenueCategory,
        'Centro de Custo': sampleCostCenter,
        'Fornecedor / Cliente': sampleClient?.nome || 'Cliente do exemplo',
        'Conta Bancária': sampleBank?.banco || '[CADASTRE UMA CONTA ATIVA PARA IMPORTAR COMO PAGO]',
        'Forma de Pagamento': 'PIX',
        'Unidade / Filial': sampleUnit,
        'Condição DDL (Ex: 30/60/90 Dias)': sampleCashTerm?.nome || '',
        'Status (PAGO, PENDENTE, ATRASADO ou CANCELADO)': 'PAGO',
        'Data Pagamento (DD-MM-AAAA)': issueDateText,
        'CPF/CNPJ Contraparte': sampleClient?.cnpj || '',
        'Documento / Referência': 'Recibo 0001',
        'Observações': 'Para lançamento pago, informe uma conta ativa da mesma filial.'
      }
    ];

    const importWorksheet = XLSX.utils.aoa_to_sheet([IMPORT_TEMPLATE_HEADERS]);
    applyTemplateSheetLayout(importWorksheet, IMPORT_TEMPLATE_COLUMN_WIDTHS);

    const exampleWorksheet = XLSX.utils.json_to_sheet(sampleData, { header: IMPORT_TEMPLATE_HEADERS });
    applyTemplateSheetLayout(exampleWorksheet, IMPORT_TEMPLATE_COLUMN_WIDTHS);

    const instructionsData = [
      { Campo: 'Uso das abas', Obrigatório: '—', Regra: 'Preencha e importe somente a primeira aba, “Lancamentos_Importar”. As demais abas são apenas para consulta.', Exemplo: 'Não copie as linhas da aba de exemplos.' },
      { Campo: 'Descrição', Obrigatório: 'Sim', Regra: 'Texto livre que identifique o lançamento.', Exemplo: 'Aluguel da clínica — setembro/2026' },
      { Campo: 'Tipo', Obrigatório: 'Sim', Regra: 'Aceita somente RECEITA ou DESPESA.', Exemplo: 'DESPESA' },
      { Campo: 'Valor', Obrigatório: 'Sim', Regra: 'Deve ser maior que zero. Informe o valor total; a condição DDL fará a divisão das parcelas.', Exemplo: '4500,00' },
      { Campo: 'Data Emissão', Obrigatório: 'Não', Regra: 'Use DD-MM-AAAA. Quando vazia, o sistema usa a data de vencimento.', Exemplo: issueDateText },
      { Campo: 'Data Competência DRE', Obrigatório: 'Não', Regra: 'Use DD-MM-AAAA. Define o mês da DRE; quando vazia, usa a data de emissão ou o vencimento.', Exemplo: issueDateText },
      { Campo: 'Data Vencimento / 1º Vencimento', Obrigatório: 'Sim', Regra: 'Use DD-MM-AAAA. Com DDL, representa o primeiro vencimento.', Exemplo: firstDueDateText },
      { Campo: 'Categoria DRE', Obrigatório: 'Sim', Regra: 'Deve ser uma categoria ativa e compatível com o tipo RECEITA ou DESPESA.', Exemplo: sampleExpenseCategory },
      { Campo: 'Centro de Custo', Obrigatório: 'Sim', Regra: 'Deve corresponder exatamente a um centro de custo ativo.', Exemplo: sampleCostCenter },
      { Campo: 'Fornecedor / Cliente', Obrigatório: 'Sim', Regra: 'Texto livre. Não precisa existir previamente no cadastro de fornecedores.', Exemplo: sampleSupplier?.nome || 'Fornecedor do exemplo' },
      { Campo: 'Conta Bancária', Obrigatório: 'Somente se PAGO', Regra: 'Se preenchida, deve ser uma conta ativa pertencente à unidade informada.', Exemplo: sampleBank?.banco || 'Deixe vazio enquanto estiver PENDENTE' },
      { Campo: 'Forma de Pagamento', Obrigatório: 'Sim', Regra: 'Use PIX, BOLETO, CARNE, CARTAO_CREDITO, CARTAO_DEBITO, DINHEIRO ou TRANSFERENCIA.', Exemplo: 'BOLETO' },
      { Campo: 'Unidade / Filial', Obrigatório: 'Sim para Admin', Regra: 'Deve corresponder exatamente a uma unidade ativa. No perfil Financeiro, o sistema usa automaticamente a unidade do usuário.', Exemplo: sampleUnit },
      { Campo: 'Condição DDL', Obrigatório: 'Não', Regra: 'Divide o valor total pelos prazos. Pode usar uma condição ativa ou informar os dias separados por barra.', Exemplo: sampleInstallmentTerm?.nome || '30/60/90' },
      { Campo: 'Status', Obrigatório: 'Não', Regra: 'Aceita PAGO, PENDENTE, ATRASADO ou CANCELADO. Quando vazio, assume PENDENTE.', Exemplo: 'PENDENTE' },
      { Campo: 'Data Pagamento', Obrigatório: 'Somente se PAGO', Regra: 'Use DD-MM-AAAA.', Exemplo: issueDateText },
      { Campo: 'CPF/CNPJ Contraparte', Obrigatório: 'Não', Regra: 'Identificação opcional do fornecedor ou cliente.', Exemplo: sampleSupplier?.cnpj || '00.000.000/0001-00' },
      { Campo: 'Documento / Referência', Obrigatório: 'Não', Regra: 'Use número da NF, boleto, contrato ou identificador externo. Anexos não são importados pela planilha.', Exemplo: 'NF 0001' },
      { Campo: 'Observações', Obrigatório: 'Não', Regra: 'Texto livre para informações complementares.', Exemplo: 'Compra referente ao mês de setembro.' }
    ];
    const instructionsWorksheet = XLSX.utils.json_to_sheet(instructionsData, {
      header: ['Campo', 'Obrigatório', 'Regra', 'Exemplo']
    });
    applyTemplateSheetLayout(instructionsWorksheet, [38, 20, 100, 48]);

    const referenceRows: Array<Array<string | number>> = [
      ['Tipo de cadastro', 'Nome aceito na importação', 'Detalhe']
    ];
    activeUnits.forEach((item) => referenceRows.push(['Unidade / Filial', item.nome, `${item.razaoSocial} — ${item.cidade}`]));
    if (activeUnits.length === 0) referenceRows.push(['Unidade / Filial', 'Nenhuma unidade ativa cadastrada', 'Cadastre uma filial antes de importar.']);
    activeCategories.forEach((item) => referenceRows.push(['Categoria DRE', item.nome, `${item.tipo} — código ${item.codigo}`]));
    activeCostCenters.forEach((item) => referenceRows.push(['Centro de Custo', item.nome, `Código ${item.codigo}`]));
    activeSuppliers.forEach((item) => referenceRows.push(['Fornecedor / Cliente', item.nome, `${item.tipo} — ${item.cnpj || 'sem CPF/CNPJ'}`]));
    activeBanks.forEach((item) => referenceRows.push(['Conta Bancária', item.banco, `Unidade: ${item.unidade}`]));
    if (activeBanks.length === 0) referenceRows.push(['Conta Bancária', 'Nenhuma conta ativa cadastrada', 'Necessária para importar lançamentos pagos.']);
    activePaymentTerms.forEach((item) => referenceRows.push(['Condição DDL', item.nome, `Prazos: ${item.prazosDias.join('/')} dias`]));
    ['PIX', 'BOLETO', 'CARNE', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'DINHEIRO', 'TRANSFERENCIA']
      .forEach((value) => referenceRows.push(['Forma de Pagamento', value, 'Valor aceito']));
    ['PAGO', 'PENDENTE', 'ATRASADO', 'CANCELADO']
      .forEach((value) => referenceRows.push(['Status', value, 'Valor aceito']));

    const referenceWorksheet = XLSX.utils.aoa_to_sheet(referenceRows);
    applyTemplateSheetLayout(referenceWorksheet, [28, 52, 65]);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, importWorksheet, 'Lancamentos_Importar');
    XLSX.utils.book_append_sheet(workbook, exampleWorksheet, 'Exemplo_Preenchimento');
    XLSX.utils.book_append_sheet(workbook, instructionsWorksheet, 'Instrucoes');
    XLSX.utils.book_append_sheet(workbook, referenceWorksheet, 'Cadastros_Atuais');
    XLSX.writeFile(workbook, 'Modelo_Importacao_Financeira_RoyalFace.xlsx');
    showToast('Modelo Excel baixado com sucesso!', 'success');
  };

  // Process File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!jsonData || jsonData.length === 0) {
          showToast('Nenhum dado encontrado na planilha.', 'error');
          return;
        }

        const detectedHeaders = Object.keys(jsonData[0]);
        setHeaders(detectedHeaders);
        setRawRows(jsonData);

        // Auto-guess column mapping
        const newMap: ColumnMapping = {
          descricao: detectedHeaders.find(h => /descri/i.test(h)) || detectedHeaders[0] || '',
          tipo: detectedHeaders.find(h => /tipo/i.test(h)) || '',
          valor: detectedHeaders.find(h => /valor|montante|quantia/i.test(h)) || '',
          dataEmissao: detectedHeaders.find(h => /emiss/i.test(h)) || '',
          dataCompetencia: detectedHeaders.find(h => /compet/i.test(h)) || '',
          dataVencimento: detectedHeaders.find(h => /venc/i.test(h)) || '',
          categoria: detectedHeaders.find(h => /categ/i.test(h)) || '',
          centroCusto: detectedHeaders.find(h => /centro|custo/i.test(h)) || '',
          fornecedorCliente: detectedHeaders.find(h => /forneced|client|raz/i.test(h)) || '',
          contaBancaria: detectedHeaders.find(h => /banco|conta/i.test(h)) || '',
          formaPagamento: detectedHeaders.find(h => /forma|pagam/i.test(h)) || '',
          unidade: detectedHeaders.find(h => /unid|filial/i.test(h)) || '',
          condicaoDDL: detectedHeaders.find(h => /ddl|condi/i.test(h)) || '',
          status: detectedHeaders.find(h => /status|situa/i.test(h)) || '',
          dataPagamento: detectedHeaders.find(h => /data.*pag|pag.*data|liquida/i.test(h)) || '',
          cpfCnpj: detectedHeaders.find(h => /cpf|cnpj/i.test(h)) || '',
          documentoRef: detectedHeaders.find(h => /documento|refer|numero.*nf|nota.*numero/i.test(h)) || '',
          observacoes: detectedHeaders.find(h => /observ|nota|coment/i.test(h)) || ''
        };

        setMapping(newMap);
        setStep('mapping');
      } catch (err) {
        showToast('Erro ao ler arquivo Excel/CSV. Verifique o formato.', 'error');
      }
    };

    reader.readAsBinaryString(file);
  };

  // Convert raw rows to mapped items
  const getMappedItems = () => {
    return rawRows.map((row, idx) => {
      const errors: string[] = [];
      const descVal = String(row[mapping.descricao] || '').trim();
      const tipoRaw = String(row[mapping.tipo] || '').toUpperCase();
      const tipo: TipoLancamento = tipoRaw.includes('REC') ? 'RECEITA' : 'DESPESA';
      if (!tipoRaw.includes('REC') && !tipoRaw.includes('DESP')) errors.push('Tipo deve ser RECEITA ou DESPESA');

      let numValor = 0;
      const rawValor = row[mapping.valor];
      if (typeof rawValor === 'number') {
        numValor = Math.abs(rawValor);
      } else if (typeof rawValor === 'string') {
        const cleaned = rawValor.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
        numValor = Math.abs(parseFloat(cleaned)) || 0;
      }

      const dataVencimento = parseImportDate(row[mapping.dataVencimento]);
      const dtEmissao = parseImportDate(row[mapping.dataEmissao], dataVencimento);
      const dataCompetencia = parseImportDate(row[mapping.dataCompetencia], dtEmissao || dataVencimento);
      const catStr = String(row[mapping.categoria] || '').trim();
      const ccStr = String(row[mapping.centroCusto] || '').trim();
      const fornStr = String(row[mapping.fornecedorCliente] || '').trim();
      const bancoStr = String(row[mapping.contaBancaria] || '').trim();
      const formaStr = String(row[mapping.formaPagamento] || '').toUpperCase();

      let formaFinal: Lancamento['formaPagamento'] = 'BOLETO';
      if (formaStr.includes('PIX')) formaFinal = 'PIX';
      else if (formaStr.includes('CARN') || formaStr.includes('CREDIAR')) formaFinal = 'CARNE';
      else if (formaStr.includes('DEB')) formaFinal = 'CARTAO_DEBITO';
      else if (formaStr.includes('CRED') || formaStr.includes('CARTAO')) formaFinal = 'CARTAO_CREDITO';
      else if (formaStr.includes('DINH') || formaStr.includes('ESP')) formaFinal = 'DINHEIRO';
      else if (formaStr.includes('TRANS') || formaStr.includes('TED')) formaFinal = 'TRANSFERENCIA';

      const unidStr = isFinance && currentUser
        ? currentUser.unit
        : String(row[mapping.unidade] || '').trim();
      const matchedUnit = units.find(
        (item) => item.ativa && normalizeLookupText(item.nome) === normalizeLookupText(unidStr)
      );
      const resolvedUnit = matchedUnit?.nome || unidStr;
      const condStr = String(row[mapping.condicaoDDL] || '').trim();
      const statusRaw = String(row[mapping.status] || '').trim().toUpperCase();
      let status: StatusLancamento = 'PENDENTE';
      if (statusRaw.includes('PAGO') || statusRaw.includes('RECEB') || statusRaw.includes('LIQUID')) status = 'PAGO';
      else if (statusRaw.includes('ATRAS')) status = 'ATRASADO';
      else if (statusRaw.includes('CANCEL')) status = 'CANCELADO';
      else if (!statusRaw && /PAGO|À\s*VISTA/i.test(condStr)) status = 'PAGO';
      if (statusRaw && !/(PAGO|RECEB|LIQUID|PEND|ATRAS|CANCEL)/.test(statusRaw)) {
        errors.push('Status deve ser PAGO, PENDENTE, ATRASADO ou CANCELADO');
      }

      const dataPagamento = status === 'PAGO' ? parseImportDate(row[mapping.dataPagamento]) : undefined;
      const cpfCnpj = String(row[mapping.cpfCnpj] || '').trim();
      const documentoRef = String(row[mapping.documentoRef] || '').trim();
      const observacoes = String(row[mapping.observacoes] || '').trim();

      // Find matching DDL prazos
      let prazosDias: number[] = [0];
      const matchedCond = condicoesPagamento.find(c => c.nome.toLowerCase() === condStr.toLowerCase());
      if (matchedCond) {
        prazosDias = matchedCond.prazosDias;
      } else if (condStr.includes('/')) {
        const nums = condStr.split('/').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
        if (nums.length > 0) prazosDias = nums;
      }

      if (!descVal) errors.push('Descrição obrigatória');
      if (numValor <= 0) errors.push('Valor deve ser maior que zero');
      if (!dataVencimento) errors.push('Data de vencimento inválida ou ausente');
      if (!catStr || !categorias.some((item) => item.ativa && item.nome.toLocaleLowerCase('pt-BR') === catStr.toLocaleLowerCase('pt-BR') && item.tipo === tipo)) errors.push('Categoria ativa incompatível com o tipo');
      if (!ccStr || !centrosCusto.some((item) => item.ativo && item.nome.toLocaleLowerCase('pt-BR') === ccStr.toLocaleLowerCase('pt-BR'))) errors.push('Centro de custo não cadastrado ou inativo');
      if (!fornStr) errors.push('Fornecedor ou cliente obrigatório');
      if (!unidStr || !matchedUnit) errors.push('Unidade não cadastrada ou inativa');
      if (!formaStr || !/(PIX|CRED|CARTAO|DEB|DINH|ESP|TRANS|TED|BOLETO|CARN)/.test(formaStr)) errors.push('Forma de pagamento inválida');
      const contaValida = bancos.some(
        (item) =>
          item.ativo &&
          normalizeLookupText(item.unidade) === normalizeLookupText(resolvedUnit) &&
          item.banco.toLocaleLowerCase('pt-BR') === bancoStr.toLocaleLowerCase('pt-BR')
      );
      if (bancoStr && !contaValida) errors.push('Conta bancária não pertence à unidade ou está inativa');
      if (status === 'PAGO' && !contaValida) errors.push('Conta bancária obrigatória para lançamento pago');
      if (status === 'PAGO' && !dataPagamento) errors.push('Data de pagamento obrigatória para lançamento pago');

      return {
        sourceIndex: idx + 1,
        descricao: descVal,
        tipo,
        valor: numValor,
        dataEmissao: dtEmissao,
        dataCompetencia,
        dataVencimento,
        categoria: catStr,
        centroCusto: ccStr,
        fornecedorCliente: fornStr,
        contaBancaria: bancoStr,
        formaPagamento: formaFinal,
        unidade: resolvedUnit,
        prazosDias,
        status,
        dataPagamento,
        cpfCnpj,
        documentoRef,
        observacoes,
        errors
      };
    });
  };

  const mappedItems = step === 'preview' ? getMappedItems() : [];
  const { sortedItems: sortedMappedItems, sortConfig, requestSort } = useSortableData(mappedItems);

  const totalReceitasImport = mappedItems.filter(i => i.tipo === 'RECEITA').reduce((acc, curr) => acc + curr.valor, 0);
  const totalDespesasImport = mappedItems.filter(i => i.tipo === 'DESPESA').reduce((acc, curr) => acc + curr.valor, 0);
  const invalidItems = mappedItems.filter((item) => item.errors.length > 0);
  const totalLancamentosGerados = mappedItems.reduce(
    (total, item) => total + Math.max(item.prazosDias.length, 1),
    0
  );

  // Execute Batch Import
  const handleConfirmImport = async () => {
    if (mappedItems.length === 0) return;
    if (invalidItems.length > 0) {
      showToast(`Corrija ${invalidItems.length} linha(s) com erro antes de importar.`, 'error');
      return;
    }
    setIsProcessing(true);

    try {
      mappedItems.forEach((item) => {
        const payload: Omit<Lancamento, 'id' | 'criadoEm'> = {
          descricao: item.descricao,
          tipo: item.tipo,
          categoria: item.categoria,
          centroCusto: item.centroCusto,
          valor: item.valor,
          dataCompetencia: item.dataCompetencia,
          dataVencimento: item.dataVencimento,
          status: item.status,
          dataPagamento: item.dataPagamento,
          fornecedorCliente: item.fornecedorCliente,
          contaBancaria: item.contaBancaria,
          formaPagamento: item.formaPagamento,
          unidade: item.unidade,
          cpfCnpjContraparte: item.cpfCnpj || undefined,
          documentoRef: item.documentoRef || undefined,
          observacoes: item.observacoes || undefined,
          impactoDRE: item.tipo
        };

        addLancamentoComDDL(
          payload,
          item.dataEmissao,
          item.prazosDias,
          item.dataVencimento,
          { adjustBankBalance: false, notify: false, audit: false }
        );
      });

      addAuditLog(
        'Importação de Planilha',
        'CRIACAO',
        `Importou ${mappedItems.length} registros e gerou ${totalLancamentosGerados} lançamentos da planilha "${fileName}", preservando os saldos bancários atuais.`
      );

      const saved = await flushPersistence();
      if (!saved) {
        showToast('A importação foi preparada, mas ainda não foi confirmada. Não importe o arquivo novamente; use “Tentar salvar”.', 'error');
        setCurrentView('receitas');
        return;
      }

      showToast(
        `${mappedItems.length} registros e ${totalLancamentosGerados} lançamentos salvos. Os saldos bancários atuais foram preservados.`,
        'success'
      );
      setCurrentView('receitas');
    } catch (err) {
      showToast('Ocorreu um erro durante a importação em lote.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#0b1c30] via-[#131b2e] to-[#0f243d] rounded-xl p-6 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#C5A059] text-white text-[10px] font-bold px-2 py-0.5 rounded tracking-wider uppercase">
              Alimentação de Dados Históricos
            </span>
            <span className="text-gray-300 text-xs">Excel / CSV Multi-Competência</span>
          </div>
          <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            <span className="material-symbols-outlined text-2xl text-[#C5A059]">table_chart</span>
            Importador de Planilhas e Histórico Financeiro
          </h2>
          <p className="text-xs text-gray-300 mt-1 max-w-2xl">
            Alimente o sistema com lançamentos passados, contas a pagar/receber e extratos antigos de forma automatizada via arquivos Excel ou CSV.
          </p>
        </div>

        <button
          onClick={handleDownloadTemplate}
          className="px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg text-xs font-bold transition flex items-center gap-2 shrink-0"
        >
          <span className="material-symbols-outlined text-base text-[#C5A059]">download</span>
          Baixar Planilha Modelo (.xlsx)
        </button>
      </div>

      {/* Wizard Progress Indicator */}
      <div className="bg-white p-4 rounded-xl border border-[#e5eeff] shadow-xs flex items-center justify-around text-xs font-bold">
        <div className={`flex items-center gap-2 ${step === 'upload' ? 'text-[#0b1c30]' : 'text-gray-400'}`}>
          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${step === 'upload' ? 'bg-[#131b2e] text-white' : 'bg-gray-200 text-gray-600'}`}>
            1
          </span>
          <span>1. Carregar Arquivo Excel</span>
        </div>

        <div className="w-12 h-px bg-gray-200"></div>

        <div className={`flex items-center gap-2 ${step === 'mapping' ? 'text-[#0b1c30]' : 'text-gray-400'}`}>
          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${step === 'mapping' ? 'bg-[#131b2e] text-white' : 'bg-gray-200 text-gray-600'}`}>
            2
          </span>
          <span>2. Mapeamento de Colunas</span>
        </div>

        <div className="w-12 h-px bg-gray-200"></div>

        <div className={`flex items-center gap-2 ${step === 'preview' ? 'text-[#0b1c30]' : 'text-gray-400'}`}>
          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${step === 'preview' ? 'bg-[#131b2e] text-white' : 'bg-gray-200 text-gray-600'}`}>
            3
          </span>
          <span>3. Pré-visualização e Importação</span>
        </div>
      </div>

      {/* STEP 1: UPLOAD */}
      {step === 'upload' && (
        <div className="bg-white p-8 rounded-xl border border-[#e5eeff] shadow-xs text-center space-y-6">
          <div className="max-w-md mx-auto space-y-3">
            <div className="w-16 h-16 bg-blue-50 text-blue-900 rounded-full flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-3xl">upload_file</span>
            </div>
            <h3 className="text-base font-bold text-[#0b1c30]">Selecione a Planilha com Informações Passadas</h3>
            <p className="text-xs text-gray-500">
              Aceita formatos <strong>.XLSX, .XLS ou .CSV</strong>. Use datas no padrão <strong>DD-MM-AAAA</strong>; planilhas antigas continuam compatíveis.
            </p>
          </div>

          <div className="max-w-lg mx-auto border-2 border-dashed border-[#d3e4fe] bg-[#f8f9ff] hover:bg-[#eff4ff] p-8 rounded-xl transition cursor-pointer relative">
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="space-y-2 pointer-events-none">
              <span className="material-symbols-outlined text-4xl text-[#C5A059]">cloud_upload</span>
              <p className="text-xs font-bold text-[#0b1c30]">Clique ou arraste seu arquivo Excel aqui</p>
              <p className="text-[11px] text-gray-400">Suporta múltiplos lançamentos e faturamentos históricos</p>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: MAPPING */}
      {step === 'mapping' && (
        <div className="bg-white p-6 rounded-xl border border-[#e5eeff] shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h3 className="text-sm font-bold text-[#0b1c30]">Mapeamento das Colunas da Planilha</h3>
              <p className="text-xs text-gray-500">Arquivo: <strong>{fileName}</strong> ({rawRows.length} linhas detectadas)</p>
            </div>
            <button
              onClick={() => setStep('upload')}
              className="px-3 py-1.5 border text-xs font-bold text-gray-600 rounded-md hover:bg-gray-50"
            >
              Trocar Arquivo
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Descrição / Histórico *</label>
              <select
                value={mapping.descricao}
                onChange={(e) => setMapping({ ...mapping, descricao: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-xs font-semibold text-[#0b1c30] bg-white"
              >
                <option value="">Selecione a coluna...</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Valor do Lançamento (R$) *</label>
              <select
                value={mapping.valor}
                onChange={(e) => setMapping({ ...mapping, valor: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-xs font-semibold text-[#0b1c30] bg-white"
              >
                <option value="">Selecione a coluna...</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Tipo (RECEITA ou DESPESA) *</label>
              <select
                value={mapping.tipo}
                onChange={(e) => setMapping({ ...mapping, tipo: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-xs font-semibold text-[#0b1c30] bg-white"
              >
                <option value="">Selecione a coluna...</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Data de Emissão (opcional)</label>
              <select
                value={mapping.dataEmissao}
                onChange={(e) => setMapping({ ...mapping, dataEmissao: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-xs font-semibold text-[#0b1c30] bg-white"
              >
                <option value="">Usar a data de vencimento...</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Data de Competência DRE</label>
              <select
                value={mapping.dataCompetencia}
                onChange={(e) => setMapping({ ...mapping, dataCompetencia: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-xs font-semibold text-[#0b1c30] bg-white"
              >
                <option value="">Usar a data de emissão...</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Data de Vencimento / 1º Vencimento *</label>
              <select value={mapping.dataVencimento} onChange={(e) => setMapping({ ...mapping, dataVencimento: e.target.value })} className="w-full px-3 py-2 border rounded-md text-xs font-semibold text-[#0b1c30] bg-white">
                <option value="">Selecione a coluna...</option>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Fornecedor ou Cliente *</label>
              <select
                value={mapping.fornecedorCliente}
                onChange={(e) => setMapping({ ...mapping, fornecedorCliente: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-xs font-semibold text-[#0b1c30] bg-white"
              >
                <option value="">Selecione a coluna...</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Categoria DRE *</label>
              <select
                value={mapping.categoria}
                onChange={(e) => setMapping({ ...mapping, categoria: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-xs font-semibold text-[#0b1c30] bg-white"
              >
                <option value="">Selecione a coluna...</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Centro de Custo *</label>
              <select value={mapping.centroCusto} onChange={(e) => setMapping({ ...mapping, centroCusto: e.target.value })} className="w-full px-3 py-2 border rounded-md text-xs font-semibold text-[#0b1c30] bg-white">
                <option value="">Selecione a coluna...</option>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                {isFinance ? 'Unidade / Filial (definida pelo seu acesso)' : 'Unidade / Filial *'}
              </label>
              <select
                value={mapping.unidade}
                onChange={(e) => setMapping({ ...mapping, unidade: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-xs font-semibold text-[#0b1c30] bg-white"
              >
                <option value="">Selecione a coluna...</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Conta Bancária / Caixa</label>
              <select value={mapping.contaBancaria} onChange={(e) => setMapping({ ...mapping, contaBancaria: e.target.value })} className="w-full px-3 py-2 border rounded-md text-xs font-semibold text-[#0b1c30] bg-white">
                <option value="">Selecione a coluna (obrigatória se PAGO)...</option>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Forma de Pagamento *</label>
              <select value={mapping.formaPagamento} onChange={(e) => setMapping({ ...mapping, formaPagamento: e.target.value })} className="w-full px-3 py-2 border rounded-md text-xs font-semibold text-[#0b1c30] bg-white">
                <option value="">Selecione a coluna...</option>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Condição DDL (Ex: 30/60/90 Dias)</label>
              <select
                value={mapping.condicaoDDL}
                onChange={(e) => setMapping({ ...mapping, condicaoDDL: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-xs font-semibold text-[#0b1c30] bg-white"
              >
                <option value="">Selecione a coluna (opcional)...</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Status do Lançamento</label>
              <select
                value={mapping.status}
                onChange={(e) => setMapping({ ...mapping, status: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-xs font-semibold text-[#0b1c30] bg-white"
              >
                <option value="">Selecione a coluna (opcional)...</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Data de Pagamento</label>
              <select
                value={mapping.dataPagamento}
                onChange={(e) => setMapping({ ...mapping, dataPagamento: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-xs font-semibold text-[#0b1c30] bg-white"
              >
                <option value="">Selecione a coluna (opcional)...</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">CPF/CNPJ da Contraparte</label>
              <select value={mapping.cpfCnpj} onChange={(e) => setMapping({ ...mapping, cpfCnpj: e.target.value })} className="w-full px-3 py-2 border rounded-md text-xs font-semibold text-[#0b1c30] bg-white">
                <option value="">Selecione a coluna (opcional)...</option>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Documento / Referência</label>
              <select value={mapping.documentoRef} onChange={(e) => setMapping({ ...mapping, documentoRef: e.target.value })} className="w-full px-3 py-2 border rounded-md text-xs font-semibold text-[#0b1c30] bg-white">
                <option value="">Selecione a coluna (opcional)...</option>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Observações</label>
              <select value={mapping.observacoes} onChange={(e) => setMapping({ ...mapping, observacoes: e.target.value })} className="w-full px-3 py-2 border rounded-md text-xs font-semibold text-[#0b1c30] bg-white">
                <option value="">Selecione a coluna (opcional)...</option>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>

          <div className="pt-4 border-t flex justify-end gap-3">
            <button
              onClick={() => setStep('preview')}
              className="px-5 py-2.5 bg-[#131b2e] text-white text-xs font-bold rounded-lg hover:bg-[#0b1c30] transition flex items-center gap-1.5 shadow-md"
            >
              <span>Avançar para Pré-visualização</span>
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: PREVIEW & IMPORT */}
      {step === 'preview' && (
        <div className="bg-white p-6 rounded-xl border border-[#e5eeff] shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
            <div>
              <h3 className="text-sm font-bold text-[#0b1c30]">Pré-visualização da Importação</h3>
              <p className="text-xs text-gray-500">
                <strong>{mappedItems.length}</strong> registros de origem gerarão <strong>{totalLancamentosGerados}</strong> lançamentos, considerando as parcelas DDL.
              </p>
              <p className="mt-1 text-[11px] font-semibold text-blue-700">
                Carga histórica: os saldos atuais das contas bancárias serão preservados.
              </p>
              {invalidItems.length > 0 && <p className="text-[11px] font-bold text-rose-700 mt-1">{invalidItems.length} linha(s) precisam ser corrigidas antes da importação.</p>}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setStep('mapping')}
                className="px-3 py-2 border text-xs font-bold text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Ajustar Mapeamento
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={isProcessing || mappedItems.length === 0 || invalidItems.length > 0}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition shadow-md flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">check_circle</span>
                <span>Confirmar e Gerar {totalLancamentosGerados} Lançamentos</span>
              </button>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg">
              <span className="text-[11px] font-semibold text-emerald-800 uppercase block">Total Receitas Importadas</span>
              <span className="text-lg font-black text-emerald-950">R$ {totalReceitasImport.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg">
              <span className="text-[11px] font-semibold text-rose-800 uppercase block">Total Despesas Importadas</span>
              <span className="text-lg font-black text-rose-950">R$ {totalDespesasImport.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
              <span className="text-[11px] font-semibold text-blue-800 uppercase block">Volume de Lançamentos</span>
              <span className="text-lg font-black text-blue-950">{totalLancamentosGerados} Lançamentos</span>
            </div>
            <div className={`${invalidItems.length === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'} border p-3 rounded-lg`}>
              <span className={`text-[11px] font-semibold uppercase block ${invalidItems.length === 0 ? 'text-emerald-800' : 'text-rose-800'}`}>Validação das Linhas</span>
              <span className={`text-lg font-black ${invalidItems.length === 0 ? 'text-emerald-950' : 'text-rose-950'}`}>{invalidItems.length === 0 ? 'Tudo certo' : `${invalidItems.length} com erro`}</span>
            </div>
          </div>

          {/* Table Preview */}
          <div className="border border-gray-200 rounded-lg overflow-x-auto text-xs max-h-96">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#f8f9ff] text-gray-700 font-bold uppercase text-[10px] sticky top-0 border-b">
                <tr>
                  <SortableTableHeader label="#" sortKey="indice" accessor={(item) => item.sourceIndex} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                  <SortableTableHeader label="Data Emissão" sortKey="emissao" accessor={(item) => item.dataEmissao} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                  <SortableTableHeader label="Competência DRE" sortKey="competencia" accessor={(item) => item.dataCompetencia} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                  <SortableTableHeader label="Vencimento" sortKey="vencimento" accessor={(item) => item.dataVencimento} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                  <SortableTableHeader label="Data Pagamento" sortKey="pagamento" accessor={(item) => item.dataPagamento} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                  <SortableTableHeader label="Tipo" sortKey="tipo" accessor={(item) => item.tipo} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                  <SortableTableHeader label="Status" sortKey="status" accessor={(item) => item.status} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                  <SortableTableHeader label="Descrição" sortKey="descricao" accessor={(item) => item.descricao} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                  <SortableTableHeader label="Fornecedor / Cliente" sortKey="fornecedor" accessor={(item) => item.fornecedorCliente} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                  <SortableTableHeader label="Categoria" sortKey="categoria" accessor={(item) => item.categoria} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                  <SortableTableHeader label="Valor (R$)" sortKey="valor" accessor={(item) => item.valor} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                  <SortableTableHeader label="Unidade" sortKey="unidade" accessor={(item) => item.unidade} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                  <SortableTableHeader label="Condição DDL" sortKey="ddl" accessor={(item) => item.prazosDias.join('/')} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                  <SortableTableHeader label="Validação" sortKey="validacao" accessor={(item) => item.errors.length} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedMappedItems.map((item) => (
                  <tr key={item.sourceIndex} className="hover:bg-gray-50">
                    <td className="p-3 text-gray-400 font-mono text-[11px]">{item.sourceIndex}</td>
                    <td className="p-3 font-semibold text-gray-700">{toDisplayDateValue(item.dataEmissao)}</td>
                    <td className="p-3 font-semibold text-sky-800">{toDisplayDateValue(item.dataCompetencia)}</td>
                    <td className="p-3 font-semibold text-gray-700">{toDisplayDateValue(item.dataVencimento)}</td>
                    <td className="p-3 font-semibold text-gray-700">{toDisplayDateValue(item.dataPagamento)}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.tipo === 'RECEITA' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {item.tipo}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.status === 'PAGO'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.status === 'ATRASADO'
                            ? 'bg-red-100 text-red-800'
                            : item.status === 'CANCELADO'
                              ? 'bg-gray-100 text-gray-700'
                              : 'bg-amber-100 text-amber-900'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-[#0b1c30] max-w-xs truncate">{item.descricao}</td>
                    <td className="p-3 text-gray-700">{item.fornecedorCliente}</td>
                    <td className="p-3 text-gray-600">{item.categoria}</td>
                    <td className="p-3 font-bold text-[#0b1c30]">R$ {item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 text-gray-600">{item.unidade}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-900 font-bold rounded text-[10px]">
                        {item.prazosDias.join('/')} DDL
                      </span>
                    </td>
                    <td className="p-3 min-w-64">{item.errors.length === 0 ? <span className="text-[10px] font-bold text-emerald-700">Pronto para importar</span> : <ul className="list-disc pl-4 text-[10px] font-semibold text-rose-700">{item.errors.map((error) => <li key={error}>{error}</li>)}</ul>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
