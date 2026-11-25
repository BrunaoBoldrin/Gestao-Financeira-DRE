import { useState, type FormEvent } from 'react';
import { useApp } from '../../context/AppContext';
import type { CustoPontoEquilibrio, PontoEquilibrioMensal } from '../../types';
import { calcularPontoEquilibrio, lerDecimalEmCentavos, MAX_CUSTOS } from '../../utils/pontoEquilibrio';

type Linha = Pick<CustoPontoEquilibrio, 'descricao' | 'tipo'> & { key: string; valor: string };

const nomesTipos: Record<CustoPontoEquilibrio['tipo'], string> = {
  FIXO: 'Fixo (R$)',
  VARIAVEL_PERCENTUAL: 'Variável (%)',
  VARIAVEL_VALOR: 'Variável (R$)',
};
const campo = 'w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A059] disabled:bg-slate-50';
const botao = 'rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50';
const centavosParaCampo = (value: number | null | undefined) =>
  value == null ? '' : (value / 100).toFixed(2).replace('.', ',');
const percentual = (value: number | null) =>
  value === null ? '—' : (value / 100).toLocaleString('pt-BR', { style: 'percent', maximumFractionDigits: 2 });
const dinheiro = (centavos: number | null) => centavos === null
  ? '—'
  : (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function Editor({ id, unidadeId, competencia, existente }: {
  id: string;
  unidadeId: string;
  competencia: string;
  existente?: PontoEquilibrioMensal;
}) {
  const { isAdmin, salvarPontoEquilibrio, persistenceStatus } = useApp();
  const [receita, setReceita] = useState(() => centavosParaCampo(existente?.receitaReferenciaCentavos));
  const [linhas, setLinhas] = useState<Linha[]>(() => (existente?.custos ?? []).map((custo, index) => ({
    ...custo, key: `salvo-${index}`, valor: centavosParaCampo(custo.valor),
  })));
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const receitaReferencia = lerDecimalEmCentavos(receita);
  const custos: CustoPontoEquilibrio[] = [];
  let dadosInvalidos = receita.trim() !== '' && receitaReferencia === null;
  for (const linha of linhas) {
    const descricao = linha.descricao.trim();
    if (!descricao && !linha.valor.trim()) continue;
    const valor = lerDecimalEmCentavos(linha.valor);
    if (!descricao || valor === null || (linha.tipo === 'VARIAVEL_PERCENTUAL' && valor > 10_000)) {
      dadosInvalidos = true;
      continue;
    }
    custos.push({ descricao, tipo: linha.tipo, valor });
  }
  const resultado = calcularPontoEquilibrio(custos, receitaReferencia);
  const bloqueado = !isAdmin || salvando;

  function alterarLinha(key: string, values: Partial<Linha>) {
    setLinhas((previous) => previous.map((linha) => linha.key === key ? { ...linha, ...values } : linha));
    setMensagem('');
  }

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dadosInvalidos || bloqueado) return;
    setSalvando(true);
    try {
      const salvo = await salvarPontoEquilibrio({ id, unidadeId, competencia, receitaReferenciaCentavos: receitaReferencia, custos });
      setMensagem(salvo
        ? persistenceStatus === 'LOCAL_DEMO' ? 'Alterações aplicadas no modo demonstração.' : 'Configuração salva.'
        : 'Não foi possível confirmar o salvamento. Confira a sincronização e tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  const metricas = [
    ['Custos fixos mensais', dinheiro(resultado.despesasFixas)],
    ['Custos variáveis sobre a receita', percentual(resultado.variaveisEmPercentual)],
    ['Margem de contribuição', percentual(resultado.margem)],
    [resultado.diferenca !== null && resultado.diferenca >= 0 ? 'Excedente no cenário' : 'Falta no cenário', dinheiro(resultado.diferenca === null ? null : Math.abs(resultado.diferenca))],
  ];

  return (
    <form onSubmit={salvar} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.5fr)]">
      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-5" aria-label="Premissas do cálculo">
        <div>
          <label className="block text-sm font-semibold mb-1" htmlFor="pe-receita">Faturamento mensal de referência (R$)</label>
          <input id="pe-receita" className={campo + ' sm:max-w-72'} value={receita} inputMode="decimal" maxLength={15}
            disabled={bloqueado} placeholder="0,00" onChange={(event) => { setReceita(event.target.value); setMensagem(''); }} />
          <p className="mt-1 text-xs text-slate-600">Use o faturamento do mesmo período dos custos variáveis informados em reais. Custos variáveis em percentual dispensam esse valor.</p>
        </div>

        <fieldset disabled={bloqueado} className="min-w-0 space-y-3">
          <legend className="mb-2 text-sm font-semibold">Custos e despesas</legend>
          {linhas.length === 0 && <p className="text-sm text-slate-500">{isAdmin ? 'Adicione os custos da unidade para começar.' : 'Nenhum custo cadastrado nesta competência.'}</p>}
          {linhas.map((linha, index) => (
            <div key={linha.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.65fr)_auto]">
              <label className="col-span-3 block min-w-0 text-xs font-medium sm:col-span-1">
                Descrição
                <input className={campo + ' mt-1'} value={linha.descricao} aria-label={`Descrição do custo ${index + 1}`}
                  maxLength={120} onChange={(event) => alterarLinha(linha.key, { descricao: event.target.value })} />
              </label>
              <label className="block min-w-0 text-xs font-medium">
                Tipo
                <select className={campo + ' mt-1'} value={linha.tipo} aria-label={`Tipo do custo ${index + 1}`}
                  onChange={(event) => alterarLinha(linha.key, { tipo: event.target.value as Linha['tipo'] })}>
                  {Object.entries(nomesTipos).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="block min-w-0 text-xs font-medium">
                {linha.tipo === 'VARIAVEL_PERCENTUAL' ? 'Percentual (%)' : 'Valor (R$)'}
                <input className={campo + ' mt-1'} value={linha.valor} inputMode="decimal" maxLength={15}
                  aria-label={`Valor do custo ${index + 1}`} onChange={(event) => alterarLinha(linha.key, { valor: event.target.value })} />
              </label>
              {isAdmin && <button type="button" aria-label={`Remover custo ${index + 1}`} className="h-9 rounded-lg px-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                onClick={() => { setLinhas((previous) => previous.filter((item) => item.key !== linha.key)); setMensagem(''); }}>
                <span aria-hidden="true" className="material-symbols-outlined text-xl">delete</span>
              </button>}
            </div>
          ))}
          {isAdmin && <button type="button" className={botao + ' border border-slate-200 text-slate-700 hover:bg-slate-50'}
            disabled={linhas.length >= MAX_CUSTOS} onClick={() => {
              setLinhas((previous) => [...previous, { key: crypto.randomUUID(), descricao: '', tipo: 'FIXO', valor: '' }]);
              setMensagem('');
            }}>Adicionar custo</button>}
        </fieldset>

        {isAdmin && <div className="border-t border-slate-100 pt-4 space-y-2">
          {dadosInvalidos && <p className="text-sm text-rose-700" role="alert">Confira a descrição e os valores. Use até duas casas decimais e percentuais de 0 a 100.</p>}
          <button type="submit" className={botao + ' bg-[#0b1c30] text-white hover:bg-[#1a2e46]'} disabled={dadosInvalidos || salvando}>
            {salvando ? 'Salvando…' : 'Salvar configuração'}
          </button>
          <p className="text-sm text-slate-700" role="status">{mensagem}</p>
        </div>}
      </section>

      <section aria-label="Resultado" className="self-start rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="bg-[#0b1c30] text-white px-5 py-5">
          <h2 className="text-sm font-medium text-[#ffdea5]">Faturamento mínimo mensal</h2>
          <p className="mt-2 text-3xl font-bold tabular-nums break-words" aria-live="polite">{dadosInvalidos ? '—' : dinheiro(resultado.ponto)}</p>
        </div>
        <dl className="divide-y divide-slate-100 px-5 py-2">
          {metricas.map(([label, value]) => <div key={label} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
            <dt className="text-slate-600">{label}</dt>
            <dd className="font-semibold tabular-nums">{dadosInvalidos || custos.length === 0 ? '—' : value}</dd>
          </div>)}
        </dl>
        {!dadosInvalidos && resultado.motivo && <p className="px-5 pb-4 text-sm text-amber-900">{resultado.motivo}</p>}
        <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-600">Cálculo mensal: custos fixos ÷ margem de contribuição.</p>
      </section>
    </form>
  );
}

export function PontoEquilibrioView() {
  const { units, selectedUnit, pontosEquilibrio } = useApp();
  const filiais = units.filter((unit) => unit.id !== 'all' && (unit.ativa || pontosEquilibrio.some((point) => point.unidadeId === unit.id)));
  const [unidadePreferida, setUnidade] = useState(() => filiais.find((unit) => unit.nome === selectedUnit)?.id ?? '');
  const filial = filiais.find((unit) => unit.id === unidadePreferida) ?? filiais[0];
  const [competencia, setCompetencia] = useState(() => new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit'
  }).format(new Date()));
  const id = `${filial?.id}:${competencia}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#0b1c30]">Ponto de Equilíbrio</h1>
        {filial && <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-[minmax(0,240px)_auto]">
          <label className="text-sm font-semibold">Unidade
            <select className={campo + ' mt-1'} value={filial.id} onChange={(event) => setUnidade(event.target.value)}>
              {filiais.map((unit) => <option key={unit.id} value={unit.id}>{unit.cidade || unit.nome}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">Competência
            <input className={campo + ' mt-1'} type="month" min="1000-01" max="9999-12" value={competencia}
              onChange={(event) => setCompetencia(event.target.value)} />
          </label>
        </div>}
      </div>
      {!filial && <p className="text-sm text-slate-600">Cadastre uma unidade para calcular o ponto de equilíbrio.</p>}
      {filial && (/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(competencia)
        ? <div key={id}>
            <Editor id={id} unidadeId={filial.id} competencia={competencia}
              existente={pontosEquilibrio.find((item) => item.id === id)} />
          </div>
        : <p className="text-sm text-slate-600">Selecione mês e ano para continuar.</p>)}
    </div>
  );
}
