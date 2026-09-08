const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,filename);
const { test }=require('node:test');
const assert=require('node:assert/strict');
const XLSX=require('xlsx');
const { exportMasters, planMasterImport, masterFingerprint }=require('../src/utils/masterWorkbook.ts');
const fixture=()=>({
 units:[{id:'all',nome:'Todas',ativa:true},{id:'u1',nome:'Rio Claro',cnpj:'001',razaoSocial:'RC',cidade:'Rio Claro',ativa:true}],
 centrosCusto:[{id:'cc1',codigo:'CC1',nome:'Clínica',responsavel:'Maria',ativo:true}],
 categorias:[{id:'p1',codigo:'4.01',nome:'Insumos',tipo:'DESPESA',grupoDRE:'CUSTO_SERVICO_PRODUTO',centroCustoId:'cc1',unidadeIds:['u1'],ativa:true}],
 fornecedores:[{id:'f1',nome:'Fornecedor',cnpj:'002',cidade:'SP',tipo:'FORNECEDOR',planoContaId:'p1',ativo:true}],
 bancos:[{id:'b1',banco:'Banco',agencia:'01',conta:'02',unidade:'Rio Claro',saldo:1000,ativo:true}],
 condicoesPagamento:[{id:'ddl1',nome:'30 dias',prazosDias:[30],ativa:true}]
});
const edit=(wb,sheet,callback)=>{
 const rows=XLSX.utils.sheet_to_json(wb.Sheets[sheet],{header:1,defval:''});
 callback(rows);
 wb.Sheets[sheet]=XLSX.utils.aoa_to_sheet(rows);
};
test('export/import XLSX round trip does not duplicate or delete masters',()=>{
 const data=fixture(), wb=XLSX.read(XLSX.write(exportMasters(data),{type:'buffer',bookType:'xlsx'}));
 const p=planMasterImport(wb,data);
 assert.deepEqual(p.errors,[]);
 assert.equal(p.changes.filter(c=>c.acao!=='Sem alteração').length,0);
 assert.deepEqual(p.next,data);
});
test('new records in same file resolve codes and names across tabs',()=>{
 const data=fixture(), wb=exportMasters(data);
 edit(wb,'Centros_Custo',r=>r.push(['','CC2','Administrativo','','SIM']));
 edit(wb,'Planos_Contas',r=>r.push(['','7.01','Aluguel','DESPESA','DESPESA_ADMINISTRATIVA','CC2','SIM']));
 edit(wb,'Favorecidos',r=>r.push(['','Locador','003','SP','FORNECEDOR','7.01','Rio Claro','SIM']));
 const p=planMasterImport(wb,data);assert.deepEqual(p.errors,[]);
 const plan=p.next.categorias.find(x=>x.codigo==='7.01');
 assert.equal(plan.centroCustoId,p.next.centrosCusto.find(x=>x.codigo==='CC2').id);
 assert.equal(p.next.fornecedores.find(x=>x.nome==='Locador').planoContaId,plan.id);
});
test('ID updates supplier and omitted rows remain',()=>{
 const data=fixture(),wb=exportMasters(data);
 edit(wb,'Favorecidos',r=>{r[1][1]='Novo nome';r[1][3]='RJ';});
 delete wb.Sheets.Centros_Custo;wb.SheetNames=wb.SheetNames.filter(x=>x!=='Centros_Custo');
 const p=planMasterImport(wb,data);assert.deepEqual(p.errors,[]);
 assert.equal(p.next.fornecedores.length,1);assert.equal(p.next.fornecedores[0].nome,'Novo nome');
 assert.deepEqual(p.next.centrosCusto,data.centrosCusto);
});
test('existing bank balances are never overwritten by stale exports',()=>{
 const data=fixture(),wb=exportMasters(data);data.bancos[0].saldo=2200;
 const p=planMasterImport(wb,data);assert.equal(p.next.bancos[0].saldo,2200);assert.deepEqual(p.errors,[]);
});
test('duplicate rows, unknown IDs and invalid links block the preview',()=>{
 for(const change of [
  r=>r.push([...r[1]]),
  r=>{r[1][0]='typo';},
  r=>{r[1][5]='missing-plan';}
 ]) {
  const data=fixture(),before=masterFingerprint(data),wb=exportMasters(data);
  edit(wb,'Favorecidos',change);const p=planMasterImport(wb,data);
  assert.ok(p.errors.length);assert.equal(masterFingerprint(data),before);
 }
});
test('missing IDs match unique codes rather than duplicating',()=>{
 const data=fixture(),wb=exportMasters(data);
 edit(wb,'Centros_Custo',r=>{r[1][0]='';r[1][3]='João';});
 const p=planMasterImport(wb,data);assert.deepEqual(p.errors,[]);
 assert.equal(p.next.centrosCusto.length,1);assert.equal(p.next.centrosCusto[0].id,'cc1');
 assert.equal(p.next.centrosCusto[0].responsavel,'João');
});
test('new plan without cost center and invalid headers are rejected',()=>{
 const data=fixture(),wb=exportMasters(data);
 edit(wb,'Planos_Contas',r=>r.push(['','7.01','Novo','DESPESA','DESPESA_ADMINISTRATIVA','','SIM']));
 assert.ok(planMasterImport(wb,data).errors.some(x=>x.includes('Centro de custo obrigatório')));
 edit(wb,'Planos_Contas',r=>{r[0][0]='Identificador';});
 assert.ok(planMasterImport(wb,data).errors.some(x=>x.includes('cabeçalhos')));
});
test('preview fingerprint changes when a master changes',()=>{
 const data=fixture(),p=planMasterImport(exportMasters(data),data);data.centrosCusto[0].responsavel='Outra';
 assert.notEqual(p.base,masterFingerprint(data));
});

test('old Fornecedores workbook tab remains supported', () => {
 const data=fixture(),wb=exportMasters(data);
 wb.Sheets.Fornecedores=wb.Sheets.Favorecidos;delete wb.Sheets.Favorecidos;
 wb.SheetNames=wb.SheetNames.map(name=>name==='Favorecidos'?'Fornecedores':name);
 assert.deepEqual(planMasterImport(wb,data).errors,[]);
});
test('duplicate old and new supplier tabs are rejected', () => {
 const data=fixture(),wb=exportMasters(data);
 wb.Sheets.Fornecedores=wb.Sheets.Favorecidos;wb.SheetNames.push('Fornecedores');
 assert.ok(planMasterImport(wb,data).errors.length);
});
