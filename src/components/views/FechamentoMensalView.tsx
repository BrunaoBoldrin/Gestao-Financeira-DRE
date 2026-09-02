import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { getMonthValue, resolveReferenceMonth } from '../../utils/dateRange';

export const FechamentoMensalView: React.FC = () => {
  const app = useApp();
  const referenceMonth = resolveReferenceMonth(app.lancamentos.map((item) => item.dataCompetencia || item.dataVencimento));
  const [month, setMonth] = useState(referenceMonth);
  const [confirmLock, setConfirmLock] = useState(false);
  const months = useMemo(() => Array.from(new Set([
    referenceMonth,
    ...app.lancamentos.map((item) => getMonthValue(item.dataCompetencia || item.dataVencimento)),
    ...app.fechamentosMensais.map((item) => item.mesAno)
  ].filter(Boolean))).sort((a, b) => b.localeCompare(a)), [referenceMonth, app.lancamentos, app.fechamentosMensais]);
  const closing = app.fechamentosMensais.find((item) => item.mesAno === month);
  const entries = app.lancamentos.filter((item) => getMonthValue(item.dataCompetencia || item.dataVencimento) === month);
  const done = closing?.checklist.filter((item) => item.concluido).length || 0;
  const total = closing?.checklist.length || 0;
  const progress = total ? Math.round(done / total * 100) : 0;
  const persist = async (message: string) => {
    const saved = await app.flushPersistence();
    app.showToast(saved ? message : 'A alteração ainda não foi confirmada pelo banco de dados.', saved ? 'success' : 'error');
  };

  return <div className="space-y-6">
    <div className="bg-white p-5 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div><h2 className="text-lg font-bold flex items-center gap-2"><span className="material-symbols-outlined">lock_clock</span>Fechamentos Mensais</h2><p className="text-xs text-gray-500">Checklist e trava independentes para cada competência.</p></div>
      <label className="text-xs font-bold">Competência <select value={month} onChange={(event) => setMonth(event.target.value)} className="ml-2 px-3 py-2 border rounded-lg bg-white">{months.map((value) => <option key={value} value={value}>{value.split('-').reverse().join('/')}</option>)}</select></label>
    </div>

    {!closing ? <div className="bg-white rounded-xl border p-8 text-center">
      <span className="material-symbols-outlined text-4xl text-gray-400">event_available</span><h3 className="font-bold mt-2">Fechamento ainda não iniciado</h3><p className="text-xs text-gray-500 mt-1">Há {entries.length} lançamento(s) nesta competência.</p>
      {app.canExecuteFinancialActions && <button onClick={async () => { app.iniciarFechamentoMensal(month); await persist('Fechamento iniciado e salvo.'); }} className="mt-4 px-4 py-2 rounded-lg bg-[#131b2e] text-white text-xs font-bold">Iniciar fechamento</button>}
    </div> : <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[['Status', closing.status], ['Lançamentos', String(entries.length)], ['Checklist', `${done}/${total} — ${progress}%`]].map(([label, value]) => <div key={label} className="bg-white border rounded-xl p-4"><p className="text-[10px] uppercase font-bold text-gray-500">{label}</p><p className="font-black mt-1">{value}</p></div>)}
      </div>
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <div className="flex justify-between"><div><h3 className="text-xs font-bold uppercase">Checklist obrigatório</h3><p className="text-[11px] text-gray-500">Todos os itens precisam ser concluídos.</p></div><span className="font-black text-sm">{progress}%</span></div>
        <div className="h-2 bg-gray-100 rounded-full"><div className="h-full bg-emerald-600 rounded-full" style={{ width: `${progress}%` }} /></div>
        {closing.checklist.map((item) => <button type="button" key={item.id} disabled={!app.canExecuteFinancialActions || closing.status === 'FECHADO'} onClick={() => app.toggleChecklistItemFechamento(month, item.id)} className={`w-full p-3 rounded-xl border text-left flex gap-3 items-center disabled:cursor-default ${item.concluido ? 'bg-emerald-50 border-emerald-200' : 'bg-white'}`}><span className="material-symbols-outlined">{item.concluido ? 'check_box' : 'check_box_outline_blank'}</span><span className="text-xs font-semibold flex-1">{item.item}</span><span className="text-[10px] text-gray-500">{item.responsavel}</span></button>)}
        <label className="text-xs font-bold block">Observações<textarea key={closing.id} defaultValue={closing.observacoes || ''} disabled={!app.canExecuteFinancialActions || closing.status === 'FECHADO'} onBlur={(event) => app.atualizarObservacoesFechamento(month, event.target.value)} className="mt-1 w-full border rounded-lg p-3 font-normal" rows={3} /></label>
        {app.isAdmin && <div className="flex justify-end">{closing.status === 'FECHADO' ? <button onClick={async () => { app.reabrirFechamentoMensal(month); await persist('Competência reaberta e salva.'); }} className="px-4 py-2 rounded-lg bg-amber-600 text-white text-xs font-bold">Reabrir competência</button> : <button disabled={progress < 100} onClick={() => setConfirmLock(true)} className="px-4 py-2 rounded-lg bg-[#131b2e] text-white text-xs font-bold disabled:bg-gray-200 disabled:text-gray-400">Aprovar e travar período</button>}</div>}
      </div>
    </>}

    {app.fechamentosMensais.length > 0 && <div className="bg-white rounded-xl border overflow-hidden"><div className="p-4 border-b text-xs font-bold uppercase">Histórico de competências</div>{[...app.fechamentosMensais].sort((a, b) => b.mesAno.localeCompare(a.mesAno)).map((item) => <div key={item.id} className="px-4 py-3 border-b last:border-0 flex justify-between text-xs"><span className="font-bold">{item.mesAno.split('-').reverse().join('/')}</span><span>{item.status}{item.fechadoPor ? ` • ${item.fechadoPor}` : ''}</span></div>)}</div>}
    {confirmLock && <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"><div className="bg-white rounded-xl p-6 max-w-md"><h3 className="font-bold">Travar {month.split('-').reverse().join('/')}?</h3><p className="text-xs text-gray-600 mt-2">Criações, edições, exclusões e liquidações nessa competência ficarão bloqueadas.</p><div className="flex justify-end gap-2 mt-5"><button onClick={() => setConfirmLock(false)} className="px-4 py-2 text-xs font-bold">Cancelar</button><button onClick={async () => { if (app.travarFechamentoMensal(month)) await persist('Competência travada e salva.'); setConfirmLock(false); }} className="px-4 py-2 bg-[#131b2e] text-white rounded-lg text-xs font-bold">Confirmar trava</button></div></div></div>}
  </div>;
};
