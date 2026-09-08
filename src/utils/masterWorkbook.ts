import * as XLSX from 'xlsx';
import type { ApplicationStateSnapshot } from '../types';
import { GRUPOS_DRE } from './dre';

export type Masters = Pick<ApplicationStateSnapshot, 'units' | 'centrosCusto' | 'categorias' | 'fornecedores' | 'bancos' | 'condicoesPagamento'>;
type Key = keyof Masters;
type Row = Record<string, string>;
export interface MasterChange { aba: string; linha: number; acao: 'Criar' | 'Atualizar' | 'Sem alteração'; nome: string; campos: string }
export interface MasterImport { next: Masters; changes: MasterChange[]; errors: string[]; base: string }
const definitions: { key: Key; sheet: string; columns: string[] }[] = [
  { key: 'units', sheet: 'Filiais', columns: ['ID','Nome','CNPJ','RazaoSocial','Cidade','Ativo'] },
  { key: 'centrosCusto', sheet: 'Centros_Custo', columns: ['ID','Codigo','Nome','Responsavel','Ativo'] },
  { key: 'categorias', sheet: 'Planos_Contas', columns: ['ID','Codigo','Nome','Tipo','GrupoDRE','CentroCusto','Ativo'] },
  { key: 'fornecedores', sheet: 'Favorecidos', columns: ['ID','Nome','CNPJ','Cidade','Tipo','PlanoConta','Filiais','Ativo'] },
  { key: 'bancos', sheet: 'Contas_Bancarias', columns: ['ID','Banco','Agencia','Conta','Filial','SaldoInicial','Ativo'] },
  { key: 'condicoesPagamento', sheet: 'Condicoes_Pagamento', columns: ['ID','Nome','PrazosDias','Ativo'] }
];
const norm = (v: unknown) => String(v ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const digits = (v: unknown) => String(v ?? '').replace(/\D/g, '');
export const masterFingerprint = (data: Masters) => JSON.stringify(definitions.map(({ key }) => data[key]));
const link = (items: {id: string; nome?: string}[], id?: string) => items.find(item => item.id === id)?.id || id || '';
export function exportMasters(data: Masters): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const instructions = [
    ['Importação e exportação dos cadastros'],
    ['Mantenha os IDs existentes. Para criar, deixe ID vazio. Sem ID, o sistema procura uma chave única antes de criar.'],
    ['Não exclui registros: linhas ausentes são preservadas. Use Ativo = NÃO para desativar.'],
    ['CentroCusto e PlanoConta aceitam ID, código ou nome exato e único. Podem referenciar novos registros da mesma planilha.'],
    ['Filiais aceita IDs ou nomes separados por ponto e vírgula. * significa todas, inclusive futuras.'],
    ['Planos novos exigem CentroCusto e são comuns a todas as filiais. Filiais pertence ao favorecido, que herda o centro do plano.'],
    ['Ativo: SIM ou NÃO. Tipo: RECEITA/DESPESA nos planos; FORNECEDOR/CLIENTE nos favorecidos.'],
    ['SaldoInicial é usado somente ao criar uma conta bancária. Saldos existentes são preservados.'],
    ['PrazosDias: dias inteiros separados por ponto e vírgula, por exemplo 30;60;90.'],
    ['Não renomeie filiais, planos ou centros existentes nesta carga: há registros históricos vinculados aos nomes.'],
    ['Campos opcionais vazios limpam o conteúdo. Abas podem ser omitidas; cabeçalhos das abas incluídas devem ser preservados.'],
    ['Usuários, senhas e transações não fazem parte desta planilha.']
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(instructions), 'Instrucoes');
  const rows: Record<Key, unknown[][]> = {
    units: data.units.filter(x => x.id !== 'all').map(x => [x.id,x.nome,x.cnpj,x.razaoSocial,x.cidade,x.ativa?'SIM':'NÃO']),
    centrosCusto: data.centrosCusto.map(x => [x.id,x.codigo,x.nome,x.responsavel,x.ativo?'SIM':'NÃO']),
    categorias: data.categorias.map(x => [x.id,x.codigo,x.nome,x.tipo,x.grupoDRE,link(data.centrosCusto,x.centroCustoId),x.ativa?'SIM':'NÃO']),
    fornecedores: data.fornecedores.map(x => [x.id,x.nome,x.cnpj,x.cidade,x.tipo || 'FORNECEDOR',link(data.categorias,x.planoContaId),x.unidadeIds === undefined?'*':x.unidadeIds.join(';'),x.ativo?'SIM':'NÃO']),
    bancos: data.bancos.map(x => [x.id,x.banco,x.agencia,x.conta,data.units.find(u=>u.nome===x.unidade)?.id || x.unidade,x.saldo,x.ativo?'SIM':'NÃO']),
    condicoesPagamento: data.condicoesPagamento.map(x => [x.id,x.nome,x.prazosDias.join(';'),x.ativa?'SIM':'NÃO'])
  };
  for(const def of definitions) {
    const ws = XLSX.utils.aoa_to_sheet([def.columns, ...rows[def.key]]);
    ws['!cols'] = def.columns.map(col => ({ wch: ['Nome','RazaoSocial','Filiais','PlanoConta','CentroCusto'].includes(col)?38:24 }));
    ws['!autofilter'] = { ref: ws['!ref']! };
    XLSX.utils.book_append_sheet(wb, ws, def.sheet);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['GrupoDRE','Descricao','Tipos'],...GRUPOS_DRE.map(g=>[g.value,g.label,g.tipos.join(';')])]),'Grupos_DRE');
  return wb;
}
export function planMasterImport(wb: XLSX.WorkBook, current: Masters): MasterImport {
  const next: Masters = JSON.parse(JSON.stringify(current));
  const errors: string[] = [], changes: MasterChange[] = [];
  const staged: {key: Key; row: Row; index: number; sheet: string; item: any; old?: any}[] = [];
  // Accept workbooks exported before the tab was renamed.
  if (wb.Sheets.Fornecedores) {
    if (wb.Sheets.Favorecidos) errors.push('Use apenas uma aba de favorecidos: Favorecidos ou Fornecedores.');
    else wb = { ...wb, SheetNames: wb.SheetNames.map(name => name === 'Fornecedores' ? 'Favorecidos' : name),
      Sheets: { ...wb.Sheets, Favorecidos: wb.Sheets.Fornecedores } };
  }
  let recognized = 0;
  for (const sheet of wb.SheetNames) if (!definitions.some(d=>d.sheet===sheet) && !['Instrucoes','Grupos_DRE'].includes(sheet)) errors.push('Aba desconhecida: '+sheet);
  const resolve = (items: any[], value: string, label: string, optional = false): any => {
    if(!value) { if(optional) return undefined; throw Error(label+' obrigatório'); }
    const exactId = items.find(x=>x.id===value);
    if(exactId) return exactId;
    const matches = items.filter(x=>norm(x.codigo)===norm(value) || norm(x.nome)===norm(value));
    if(matches.length!==1) throw Error(label+(matches.length?' ambíguo; use o ID':' não encontrado')+': '+value);
    return matches[0];
  };
  for(const def of definitions) {
    if(!wb.Sheets[def.sheet]) continue;
    recognized++;
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[def.sheet], { header: 1, defval: '', raw: true });
    if(matrix.length > 20001) { errors.push(def.sheet+': máximo de 20.000 linhas'); continue; }
    const headers = (matrix[0] || []).map(x=>String(x).trim());
    if(def.columns.some(c=>!headers.includes(c)) || new Set(headers).size!==headers.length) { errors.push(def.sheet+': cabeçalhos ausentes ou duplicados; use a planilha exportada'); continue; }
    const touched = new Set<string>();
    for(let i=1;i<matrix.length;i++) {
      if(!matrix[i].some(v=>String(v).trim())) continue;
      const row: Row = Object.fromEntries(headers.map((h,j)=>[h,String(matrix[i][j] ?? '').trim()]));
      try {
        const items = next[def.key] as any[];
        let old = row.ID ? items.find(x=>x.id===row.ID) : undefined;
        if(row.ID && !old) throw Error('ID desconhecido; deixe o ID vazio para criar');
        if(old?.id==='all') throw Error('O registro consolidado não pode ser alterado');
        if(!row.ID) {
          const candidates = items.filter(x=>{
            if(x.id==='all') return false;
            if(def.key==='categorias' || def.key==='centrosCusto') return norm(x.codigo)===norm(row.Codigo) && Boolean(row.Codigo);
            if(def.key==='units' || def.key==='fornecedores') return row.CNPJ ? digits(x.cnpj)===digits(row.CNPJ) : norm(x.nome)===norm(row.Nome);
            if(def.key==='bancos') {
              const unit = resolve(next.units.filter(u=>u.id!=='all'),row.Filial,'Filial');
              return x.unidade===unit.nome && norm(x.banco)===norm(row.Banco) && x.agencia===row.Agencia && x.conta===row.Conta;
            }
            return norm(x.nome)===norm(row.Nome);
          });
          if(candidates.length>1) throw Error('Mais de um cadastro corresponde à linha; informe o ID');
          old=candidates[0];
        }
        const id = old?.id || 'cad-'+crypto.randomUUID();
        if(touched.has(id)) throw Error('Cadastro repetido na mesma aba');
        touched.add(id);
        const active = norm(row.Ativo);
        if(!['sim','nao'].includes(active)) throw Error('Ativo deve ser SIM ou NÃO');
        const name = def.key==='bancos'?row.Banco:row.Nome;
        if(!name) throw Error('Nome obrigatório');
        if(old && ['units','categorias','centrosCusto'].includes(def.key) && name!==old.nome) throw Error('Mantenha o nome existente para preservar os vínculos históricos');
        let item: any = { ...old, id };
        if(def.key==='units') item={...item,nome:name,cnpj:row.CNPJ,razaoSocial:row.RazaoSocial,cidade:row.Cidade,ativa:active==='sim'};
        if(def.key==='centrosCusto') item={...item,codigo:row.Codigo,nome:name,responsavel:row.Responsavel,ativo:active==='sim'};
        if(def.key==='categorias') {
          if(!['RECEITA','DESPESA'].includes(row.Tipo)) throw Error('Tipo inválido');
          if(old && old.tipo!==row.Tipo) throw Error('Não altere o tipo de um plano existente');
          if(!GRUPOS_DRE.some(g=>g.value===row.GrupoDRE && g.tipos.includes(row.Tipo as any))) throw Error('GrupoDRE incompatível com o tipo');
          item={...item,codigo:row.Codigo,nome:name,tipo:row.Tipo,grupoDRE:row.GrupoDRE,ativa:active==='sim'};
        }
        if(def.key==='fornecedores') {
          if(!['FORNECEDOR','CLIENTE'].includes(row.Tipo)) throw Error('Tipo deve ser FORNECEDOR ou CLIENTE');
          item={...item,nome:name,cnpj:row.CNPJ,cidade:row.Cidade,tipo:row.Tipo,ativo:active==='sim'};
        }
        if(def.key==='bancos') {
          const unit=resolve(next.units.filter(u=>u.id!=='all'),row.Filial,'Filial');
          const amount=Number(row.SaldoInicial.replace(/\s/g,'').replace(',','.'));
          if(!old && (!row.SaldoInicial || !Number.isFinite(amount))) throw Error('SaldoInicial inválido; use número sem separador de milhares');
          if(old && old.unidade!==unit.nome) throw Error('Não é permitido mover uma conta existente para outra filial');
          item={...item,banco:name,agencia:row.Agencia,conta:row.Conta,unidade:unit.nome,saldo:old?old.saldo:amount,ativo:active==='sim'};
        }
        if(def.key==='condicoesPagamento') {
          if(!/^\d+(\s*;\s*\d+)*$/.test(row.PrazosDias)) throw Error('PrazosDias inválido; exemplo: 30;60;90');
          const prazos=row.PrazosDias.split(';').map(Number);
          if(prazos.some(n=>!Number.isSafeInteger(n)||n>36500)) throw Error('Prazo fora do limite');
          item={...item,nome:name,prazosDias:prazos,ativa:active==='sim'};
        }
        if(['categorias','centrosCusto'].includes(def.key)) {
          if(!row.Codigo) throw Error('Código obrigatório');
          if(items.some(x=>x.id!==id && norm(x.codigo)===norm(row.Codigo))) throw Error('Código já utilizado em outro cadastro');
        }
        if(old) items[items.findIndex(x=>x.id===id)]=item; else items.push(item);
        staged.push({key:def.key,row,index:i+1,sheet:def.sheet,item,old});
      } catch(error) { errors.push(def.sheet+', linha '+(i+1)+': '+(error as Error).message); }
    }
  }
  if(!recognized) errors.push('Nenhuma aba de cadastros encontrada');
  for(const entry of staged) {
    const {row,item,old,key,sheet,index}=entry;
    try {
      if(key==='categorias') {
        const center=resolve(next.centrosCusto,row.CentroCusto,'Centro de custo',Boolean(old));
        if(center && !center.ativo && center.id!==old?.centroCustoId) throw Error('Centro de custo inativo');
        item.centroCustoId=center?.id;

      }
      if(key==='fornecedores') {
        const plan=resolve(next.categorias,row.PlanoConta,'Plano de contas',true);
        if(plan && (plan.tipo!=='DESPESA' || (!plan.ativa && plan.id!==old?.planoContaId))) throw Error('Plano do favorecido deve ser uma despesa ativa');
        item.planoContaId=plan?.id;
        if(row.Filiais==='*') delete item.unidadeIds;
        else {
          if(!row.Filiais) throw Error('Informe Filiais ou *');
          item.unidadeIds=[...new Set(row.Filiais.split(';').map(v=>resolve(next.units.filter(x=>x.id!=='all'),v.trim(),'Filial').id))];
        }
        delete item.centroCustoId;
      }
      const equal = old && JSON.stringify(old)===JSON.stringify(item);
      const labels: Record<string,string> = { nome:'Nome',codigo:'Código',cnpj:'CNPJ',razaoSocial:'Razão social',cidade:'Cidade',responsavel:'Responsável',tipo:'Tipo',grupoDRE:'Grupo DRE',centroCustoId:'Centro de custo',planoContaId:'Plano de contas',unidadeIds:'Filiais',ativa:'Ativo',ativo:'Ativo',banco:'Banco',agencia:'Agência',conta:'Conta',unidade:'Filial',saldo:'Saldo inicial',prazosDias:'Prazos' };
      const changedKeys = Object.keys(labels).filter(k=>JSON.stringify(old?.[k])!==JSON.stringify(item[k]));
      changes.push({aba:sheet,linha:index,acao:old?(equal?'Sem alteração':'Atualizar'):'Criar',nome:item.nome || item.banco,campos:changedKeys.map(k=>labels[k]).join(', ') || '—'});
    } catch(error) { errors.push(sheet+', linha '+index+': '+(error as Error).message); }
  }
  return { next, changes, errors, base: masterFingerprint(current) };
}
