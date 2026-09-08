import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { useApp } from '../../context/AppContext';
import { exportMasters, planMasterImport, type MasterImport } from '../../utils/masterWorkbook';
import { ModalOverlay } from './ModalOverlay';

export const MasterDataExchange: React.FC = () => {
  const app = useApp();
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<MasterImport | null>(null);
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(false);
  const [fileName, setFileName] = useState('');
  const buttonClass = 'rounded-lg border border-[#d3e4fe] px-3 py-2 text-xs font-bold bg-white disabled:opacity-50';
  const masters = () => ({
    units: app.units, categorias: app.categorias, centrosCusto: app.centrosCusto,
    fornecedores: app.fornecedores, bancos: app.bancos, condicoesPagamento: app.condicoesPagamento
  });
  const load = async (file?: File) => {
    if (!file || !app.isAdmin) return;
    if(file.size > 20 * 1024 * 1024) { app.showToast('A planilha deve ter no máximo 20 MB.', 'error'); return; }
    setBusy(true);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      setPreview(planMasterImport(workbook, masters()));
      setFileName(file.name);
      setApplied(false);
    } catch(error) { app.showToast('Não foi possível ler a planilha. Use o arquivo exportado pelo sistema.', 'error'); }
    finally { setBusy(false); }
  };
  const apply = async () => {
    if(!preview || busy) return;
    setBusy(true);
    try {
      if(!applied) {
        if(!app.applyMasterImport(preview)) return;
        setApplied(true);
      }
      const saved=await app.flushPersistence();
      if(saved) { app.showToast('Cadastros importados e salvos.', 'success'); setPreview(null); }
      else app.showToast('As alterações ainda não foram salvas. Use Tentar salvar.', 'error');
    } catch(error) { app.showToast('Não foi possível confirmar o salvamento. Tente salvar novamente.', 'error'); }
    finally { setBusy(false); }
  };
  if(!app.isAdmin) return null;
  return <>
    <button className={buttonClass} disabled={busy} onClick={() => {
      try { XLSX.writeFile(exportMasters(masters()), 'Cadastros-Financeiros.xlsx', { compression: true }); }
      catch { app.showToast('Não foi possível exportar os cadastros.', 'error'); }
    }}>Exportar cadastros</button>
    <button className={buttonClass} disabled={busy} onClick={() => fileInput.current?.click()}>{busy ? 'Processando...' : 'Importar cadastros'}</button>
    <input ref={fileInput} type="file" accept=".xlsx" className="sr-only" aria-label="Importar planilha de cadastros"
      onChange={event => { void load(event.target.files?.[0]); event.target.value=''; }} />
    {preview && <ModalOverlay className="fixed inset-0 z-50 bg-black/50">
      <div className="w-full max-w-4xl rounded-xl bg-white shadow-xl">
        <div className="p-5 border-b space-y-2">
          <h3 className="font-bold text-lg">Revisar importação de cadastros</h3>
          <p className="text-xs text-gray-500 break-words">{fileName}</p>
          <p className="text-sm">{preview.changes.filter(x=>x.acao==='Criar').length} novos · {preview.changes.filter(x=>x.acao==='Atualizar').length} atualizações · {preview.changes.filter(x=>x.acao==='Sem alteração').length} sem alteração</p>
          <p className="text-xs text-gray-500">Nenhum registro será excluído. Os saldos bancários existentes serão preservados.</p>
        </div>
        {preview.errors.length > 0 && <div className="m-4 p-3 rounded-lg bg-rose-50 text-rose-800 text-xs" role="alert">
          <p className="font-bold mb-2">Corrija os {preview.errors.length} erros e importe novamente. Nenhuma alteração foi aplicada.</p>
          <ul className="list-disc pl-4 space-y-1">{preview.errors.map((error,i)=><li key={i}>{error}</li>)}</ul>
        </div>}
        <div className="overflow-x-auto max-h-80" tabIndex={0} role="region" aria-label="Alterações nos cadastros">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#eff4ff]"><tr>{['Aba','Linha','Ação','Cadastro','Campos alterados'].map(label=><th key={label} className="p-3">{label}</th>)}</tr></thead>
            <tbody>{preview.changes.map((item,i)=><tr key={i} className="border-b"><td className="p-3">{item.aba}</td><td className="p-3">{item.linha}</td><td className="p-3">{item.acao}</td><td className="p-3">{item.nome}</td><td className="p-3">{item.campos}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="p-4 flex flex-wrap justify-end gap-2">
          <button className={buttonClass} disabled={busy} onClick={()=>setPreview(null)}>{applied?'Fechar':'Cancelar'}</button>
          <button className="px-4 py-2 rounded-lg bg-[#131b2e] text-white text-sm font-bold disabled:opacity-50"
            disabled={busy || preview.errors.length > 0 || !preview.changes.some(x=>x.acao!=='Sem alteração')} onClick={()=>void apply()}>
            {busy?'Salvando...':applied?'Tentar salvar':'Confirmar importação'}
          </button>
        </div>
      </div>
    </ModalOverlay>}
  </>;
};
