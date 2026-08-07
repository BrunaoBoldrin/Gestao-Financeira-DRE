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
  categoria: string;
  centroCusto: string;
  fornecedorCliente: string;
  contaBancaria: string;
  formaPagamento: string;
  unidade: string;
  condicaoDDL: string;
  status: string;
  dataPagamento: string;
}

const toDateValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const parseImportDate = (rawDate: unknown, fallback = '') => {
  if (rawDate instanceof Date && !Number.isNaN(rawDate.getTime())) return toDateValue(rawDate);

  if (typeof rawDate === 'string' && rawDate.trim()) {
    const value = rawDate.trim();
    if (value.includes('/')) {
      const parts = value.split('/');
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
        return `${year}-${month}-${day}`;
      }
    }

    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.substring(0, 10);
  }

  return fallback;
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
    categoria: '',
    centroCusto: '',
    fornecedorCliente: '',
    contaBancaria: '',
    formaPagamento: '',
    unidade: '',
    condicaoDDL: '',
    status: '',
    dataPagamento: ''
  });

  // Sample Excel Download Generator
  const handleDownloadTemplate = () => {
    const sampleData = [
      {
        'Descrição': 'Compra Botox 100U Galderma (NF 45892)',
        'Tipo (RECEITA ou DESPESA)': 'DESPESA',
        'Valor (R$)': 4500.00,
        'Data Emissão (AAAA-MM-DD)': '2024-05-10',
        'Categoria DRE': 'Insumos Médicos & Estéticos',
        'Centro de Custo': 'Clínica / Atendimento',
        'Fornecedor / Cliente': 'Galderma Brasil Ltda',
        'Conta Bancária': 'Itaú Uniclass - C/C 45892-1',
        'Forma de Pagamento': 'BOLETO',
        'Unidade / Filial': 'Royal Face - Matriz',
        'Condição DDL (Ex: 30/60/90 Dias)': '30/60/90 Dias (3x)',
        'Status (PAGO ou PENDENTE)': 'PENDENTE',
        'Data Pagamento (AAAA-MM-DD)': ''
      },
      {
        'Descrição': 'Pacote Harmonização Facial - Paciente Carla S.',
        'Tipo (RECEITA ou DESPESA)': 'RECEITA',
        'Valor (R$)': 3800.00,
        'Data Emissão (AAAA-MM-DD)': '2024-05-12',
        'Categoria DRE': 'Procedimentos Estéticos',
        'Centro de Custo': 'Clínica / Atendimento',
        'Fornecedor / Cliente': 'Carla Souza',
        'Conta Bancária': 'Bradesco - C/C 12904-8',
        'Forma de Pagamento': 'CARTAO_CREDITO',
        'Unidade / Filial': 'Royal Face - Matriz',
        'Condição DDL (Ex: 30/60/90 Dias)': 'À Vista / PAGO (0 dias)',
        'Status (PAGO ou PENDENTE)': 'PAGO',
        'Data Pagamento (AAAA-MM-DD)': '2024-05-12'
      },
      {
        'Descrição': 'Aluguel Imóvel Clínica Maio/2024',
        'Tipo (RECEITA ou DESPESA)': 'DESPESA',
        'Valor (R$)': 8500.00,
        'Data Emissão (AAAA-MM-DD)': '2024-05-01',
        'Categoria DRE': 'Aluguel & Condomínio',
        'Centro de Custo': 'Administrativo / Matriz',
        'Fornecedor / Cliente': 'Imobiliária Nobre Ltda',
        'Conta Bancária': 'Itaú Uniclass - C/C 45892-1',
        'Forma de Pagamento': 'TRANSFERENCIA',
        'Unidade / Filial': 'Royal Face - Matriz',
        'Condição DDL (Ex: 30/60/90 Dias)': '30 Dias (1x)',
        'Status (PAGO ou PENDENTE)': 'PAGO',
        'Data Pagamento (AAAA-MM-DD)': '2024-05-31'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Lancamentos_Modelo');
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
          dataEmissao: detectedHeaders.find(h => /data|emiss|vencim/i.test(h)) || '',
          categoria: detectedHeaders.find(h => /categ/i.test(h)) || '',
          centroCusto: detectedHeaders.find(h => /centro|custo/i.test(h)) || '',
          fornecedorCliente: detectedHeaders.find(h => /forneced|client|raz/i.test(h)) || '',
          contaBancaria: detectedHeaders.find(h => /banco|conta/i.test(h)) || '',
          formaPagamento: detectedHeaders.find(h => /forma|pagam/i.test(h)) || '',
          unidade: detectedHeaders.find(h => /unid|filial/i.test(h)) || '',
          condicaoDDL: detectedHeaders.find(h => /ddl|condi/i.test(h)) || '',
          status: detectedHeaders.find(h => /status|situa/i.test(h)) || '',
          dataPagamento: detectedHeaders.find(h => /data.*pag|pag.*data|liquida/i.test(h)) || ''
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
      const descVal = row[mapping.descricao] ? String(row[mapping.descricao]).trim() : `Lançamento Importado #${idx + 1}`;
      
      const tipoRaw = String(row[mapping.tipo] || '').toUpperCase();
      const tipo: TipoLancamento = tipoRaw.includes('REC') ? 'RECEITA' : 'DESPESA';

      let numValor = 0;
      const rawValor = row[mapping.valor];
      if (typeof rawValor === 'number') {
        numValor = Math.abs(rawValor);
      } else if (typeof rawValor === 'string') {
        const cleaned = rawValor.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
        numValor = Math.abs(parseFloat(cleaned)) || 0;
      }

      const dtEmissao = parseImportDate(
        row[mapping.dataEmissao],
        new Date().toISOString().substring(0, 10)
      );

      const catStr = String(row[mapping.categoria] || '').trim() || (tipo === 'RECEITA' ? 'Procedimentos Estéticos' : 'Insumos Médicos & Estéticos');
      const ccStr = String(row[mapping.centroCusto] || '').trim() || 'Clínica / Atendimento';
      const fornStr = String(row[mapping.fornecedorCliente] || '').trim() || (tipo === 'RECEITA' ? 'Cliente Diverso' : 'Fornecedor Diverso');
      const bancoStr = String(row[mapping.contaBancaria] || '').trim() || 'Itaú Uniclass - C/C 45892-1';
      const formaStr = String(row[mapping.formaPagamento] || '').toUpperCase();

      let formaFinal: any = 'BOLETO';
      if (formaStr.includes('PIX')) formaFinal = 'PIX';
      else if (formaStr.includes('CRED') || formaStr.includes('CARTAO')) formaFinal = 'CARTAO_CREDITO';
      else if (formaStr.includes('DEB')) formaFinal = 'CARTAO_DEBITO';
      else if (formaStr.includes('DINH') || formaStr.includes('ESP')) formaFinal = 'DINHEIRO';
      else if (formaStr.includes('TRANS') || formaStr.includes('TED')) formaFinal = 'TRANSFERENCIA';

      const unidStr = isFinance && currentUser
        ? currentUser.unit
        : String(row[mapping.unidade] || '').trim() || 'Royal Face - Matriz';
      const condStr = String(row[mapping.condicaoDDL] || '').trim();
      const statusRaw = String(row[mapping.status] || '').trim().toUpperCase();
      let status: StatusLancamento = 'PENDENTE';
      if (statusRaw.includes('PAGO') || statusRaw.includes('RECEB') || statusRaw.includes('LIQUID')) status = 'PAGO';
      else if (statusRaw.includes('ATRAS')) status = 'ATRASADO';
      else if (statusRaw.includes('CANCEL')) status = 'CANCELADO';
      else if (!statusRaw && /PAGO|À\s*VISTA/i.test(condStr)) status = 'PAGO';

      const dataPagamento = status === 'PAGO'
        ? parseImportDate(row[mapping.dataPagamento], dtEmissao)
        : undefined;

      // Find matching DDL prazos
      let prazosDias: number[] = [0];
      const matchedCond = condicoesPagamento.find(c => c.nome.toLowerCase() === condStr.toLowerCase());
      if (matchedCond) {
        prazosDias = matchedCond.prazosDias;
      } else if (condStr.includes('/')) {
        const nums = condStr.split('/').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
        if (nums.length > 0) prazosDias = nums;
      }

      return {
        sourceIndex: idx + 1,
        descricao: descVal,
        tipo,
        valor: numValor,
        dataEmissao: dtEmissao,
        categoria: catStr,
        centroCusto: ccStr,
        fornecedorCliente: fornStr,
        contaBancaria: bancoStr,
        formaPagamento: formaFinal,
        unidade: unidStr,
        prazosDias,
        status,
        dataPagamento
      };
    });
  };

  const mappedItems = step === 'preview' ? getMappedItems() : [];
  const { sortedItems: sortedMappedItems, sortConfig, requestSort } = useSortableData(mappedItems);

  const totalReceitasImport = mappedItems.filter(i => i.tipo === 'RECEITA').reduce((acc, curr) => acc + curr.valor, 0);
  const totalDespesasImport = mappedItems.filter(i => i.tipo === 'DESPESA').reduce((acc, curr) => acc + curr.valor, 0);
  const totalLancamentosGerados = mappedItems.reduce(
    (total, item) => total + Math.max(item.prazosDias.length, 1),
    0
  );

  // Execute Batch Import
  const handleConfirmImport = () => {
    if (mappedItems.length === 0) return;
    setIsProcessing(true);

    try {
      mappedItems.forEach((item) => {
        const payload: Omit<Lancamento, 'id' | 'criadoEm'> = {
          descricao: item.descricao,
          tipo: item.tipo,
          categoria: item.categoria,
          centroCusto: item.centroCusto,
          valor: item.valor,
          dataVencimento: item.dataEmissao,
          status: item.status,
          dataPagamento: item.dataPagamento,
          fornecedorCliente: item.fornecedorCliente,
          contaBancaria: item.contaBancaria,
          formaPagamento: item.formaPagamento,
          unidade: item.unidade
        };

        if (item.prazosDias.length >= 1) {
          addLancamentoComDDL(payload, item.dataEmissao, item.prazosDias);
        } else {
          addLancamento(payload);
        }
      });

      showToast(
        `Sucesso! ${mappedItems.length} registros processados e ${totalLancamentosGerados} lançamentos gerados da planilha "${fileName}".`,
        'success'
      );
      setCurrentView('despesas');
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
              Aceita formatos <strong>.XLSX, .XLS ou .CSV</strong>. O arquivo pode conter receitas, despesas, fornecedores e vencimentos DDL.
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
              <label className="block text-xs font-bold text-gray-700 mb-1">Tipo (RECEITA ou DESPESA)</label>
              <select
                value={mapping.tipo}
                onChange={(e) => setMapping({ ...mapping, tipo: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-xs font-semibold text-[#0b1c30] bg-white"
              >
                <option value="">Selecione a coluna (opcional)...</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Data de Emissão / Vencimento *</label>
              <select
                value={mapping.dataEmissao}
                onChange={(e) => setMapping({ ...mapping, dataEmissao: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-xs font-semibold text-[#0b1c30] bg-white"
              >
                <option value="">Selecione a coluna...</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Fornecedor ou Cliente</label>
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
              <label className="block text-xs font-bold text-gray-700 mb-1">Categoria DRE</label>
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
              <label className="block text-xs font-bold text-gray-700 mb-1">Unidade / Filial</label>
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
                disabled={isProcessing || mappedItems.length === 0}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition shadow-md flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">check_circle</span>
                <span>Confirmar e Gerar {totalLancamentosGerados} Lançamentos</span>
              </button>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
          </div>

          {/* Table Preview */}
          <div className="border border-gray-200 rounded-lg overflow-x-auto text-xs max-h-96">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#f8f9ff] text-gray-700 font-bold uppercase text-[10px] sticky top-0 border-b">
                <tr>
                  <SortableTableHeader label="#" sortKey="indice" accessor={(item) => item.sourceIndex} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                  <SortableTableHeader label="Data Emissão" sortKey="emissao" accessor={(item) => item.dataEmissao} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                  <SortableTableHeader label="Data Pagamento" sortKey="pagamento" accessor={(item) => item.dataPagamento} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                  <SortableTableHeader label="Tipo" sortKey="tipo" accessor={(item) => item.tipo} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                  <SortableTableHeader label="Status" sortKey="status" accessor={(item) => item.status} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                  <SortableTableHeader label="Descrição" sortKey="descricao" accessor={(item) => item.descricao} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                  <SortableTableHeader label="Fornecedor / Cliente" sortKey="fornecedor" accessor={(item) => item.fornecedorCliente} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                  <SortableTableHeader label="Categoria" sortKey="categoria" accessor={(item) => item.categoria} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                  <SortableTableHeader label="Valor (R$)" sortKey="valor" accessor={(item) => item.valor} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                  <SortableTableHeader label="Unidade" sortKey="unidade" accessor={(item) => item.unidade} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                  <SortableTableHeader label="Condição DDL" sortKey="ddl" accessor={(item) => item.prazosDias.join('/')} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedMappedItems.map((item) => (
                  <tr key={item.sourceIndex} className="hover:bg-gray-50">
                    <td className="p-3 text-gray-400 font-mono text-[11px]">{item.sourceIndex}</td>
                    <td className="p-3 font-semibold text-gray-700">{item.dataEmissao}</td>
                    <td className="p-3 font-semibold text-gray-700">{item.dataPagamento || '—'}</td>
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
