import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
import test from 'node:test';
const root=fileURLToPath(new URL('..',import.meta.url));
const db=new DatabaseSync(':memory:');
const journal=JSON.parse(fs.readFileSync(path.join(root,'drizzle/meta/_journal.json'),'utf8'));
for(const e of journal.entries.filter(e=>e.idx<14))db.exec(fs.readFileSync(path.join(root,'drizzle',e.tag+'.sql'),'utf8'));
db.exec(`INSERT INTO temporadas(id,nome,ativa,total_etapas,pilotos_por_serie) VALUES('old','Temporada original',1,2,15);
INSERT INTO calendario(temporada_id,etapa,pista,multiplicador) VALUES('old',1,'Interlagos',1),('old',2,'Spa',1);`);
for(let d=0;d<4;d++){
 const serie='ABCD'[d];db.prepare('INSERT INTO divisoes(temporada_id,codigo,nome,ordem,limite_pilotos) VALUES(?,?,?,?,15)').run('old',serie,'Série '+serie,d+1);
 for(let i=0;i<15;i++){const id='SGT'+String(d*15+i+1).padStart(3,'0');db.prepare('INSERT INTO pilotos(id,apelido) VALUES(?,?)').run(id,'Piloto '+id);db.prepare('INSERT INTO inscricoes(temporada_id,piloto_id,serie,situacao) VALUES(?,?,?,?)').run('old',id,serie,'ativo');db.prepare('INSERT INTO corridas(temporada_id,etapa,piloto_id,pontos,posicao_final,compareceu) VALUES(?,1,?,?,?,1)').run('old',id,100-i,i+1);}
}
db.exec("INSERT INTO caixa(temporada_id,data,piloto_id,nome,tipo,valor) VALUES('old','2026-09-12','SGT001','Piloto SGT001','Inscrição',2500)");
const before=Object.fromEntries(['pilotos','inscricoes','corridas','caixa'].map(t=>[t,db.prepare(`SELECT * FROM ${t}`).all()]));
for(const e of journal.entries.filter(e=>e.idx>=14))db.exec(fs.readFileSync(path.join(root,'drizzle',e.tag+'.sql'),'utf8'));
let allowed=true;
const binding={prepare(sql){const statement=db.prepare(sql);let values=[];return {bind(...v){values=v;return this},async first(column){const r=statement.get(...values)??null;return column?r?.[column]??null:r},async all(){return {results:statement.all(...values)}},async run(){return {meta:{changes:statement.run(...values).changes}}}}},async batch(statements){db.exec('BEGIN');try{const output=[];for(const s of statements)output.push(await s.all());db.exec('COMMIT');return output}catch(e){db.exec('ROLLBACK');throw e}}};
globalThis.centralTest={binding,user:()=>allowed?{id:'owner',email:'owner@example.test',fullName:'Administrador',displayName:'Administrador'}:null,access:()=>allowed?{id:1,email:'owner@example.test',papel:'administrador'}:null};
const cache=new Map();
async function load(name){
 if(cache.has(name))return cache.get(name);
 let source=fs.readFileSync(path.join(root,name),'utf8');
 const matches=[...source.matchAll(/import\s+[\s\S]*?\s+from\s+["'](@\/[^"']+)["'];/g)];
 for(const m of matches){const spec=m[1];let replacement;
  if(spec==='@/db')replacement='const getD1Binding=()=>globalThis.centralTest.binding;';
  else if(spec==='@/app/chatgpt-auth')replacement='const getChatGPTUser=async()=>globalThis.centralTest.user();';
  else if(spec==='@/db/access')replacement='const ensureCurrentUserAccess=async()=>globalThis.centralTest.access();';
  else {const target=spec.slice(2)+'.ts';const module=await load(target);globalThis.centralTest[target]=module;const names=m[0].match(/import\s*\{([\s\S]*?)\}/)?.[1];if(!names)continue;replacement='const {'+names.replace(/\btype\s+[^,}]+,?/g,'')+'}=globalThis.centralTest['+JSON.stringify(target)+'];';}
  source=source.replace(m[0],replacement);
 }
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 const result=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));cache.set(name,result);return result;
}
const admin=await load('app/api/admin/route.ts'),ledger=await load('app/api/livro-caixa/route.ts');
const post=(body)=>admin.POST(new Request('http://local/api/admin',{method:'POST',body:JSON.stringify(body)}));
test('additive migration preserves every pilot, participation, result and original payment',()=>{for(const t of Object.keys(before))assert.deepEqual(db.prepare(`SELECT ${Object.keys(before[t][0]).map(column=>`"${column}"`).join(",")} FROM ${t}`).all(),before[t]);assert.equal(db.prepare('SELECT count(*) n FROM atividades').get().n,0)});
test('general ledger accepts unrelated income/expense, preserves cents and consolidates original payments once',async()=>{
 for(const [natureza,valor] of [['receita',1000],['despesa',750]])assert.equal((await ledger.POST(new Request('http://local/api/livro-caixa',{method:'POST',body:JSON.stringify({natureza,valor,categoria:'Outros',descricao:'Teste',data:'2026-09-12'})}))).status,200);
 const {entries}=await (await ledger.GET()).json();assert.equal(entries.length,3);assert.equal(entries.reduce((n,e)=>n+(e.natureza==='despesa'?-e.valor:e.valor),0),2750);assert.equal(entries.filter(e=>e.temporada_id===null).length,2);
 assert.equal((await ledger.POST(new Request('http://local/api/livro-caixa',{method:'POST',body:JSON.stringify({natureza:'despesa',valor:-1,categoria:'Teste',descricao:'Teste',data:'2026-09-12'})}))).status,400);
});
test('closure requires confirmation; freeze blocks writes and persists same scores',async()=>{
 assert.equal((await post({action:'encerrar',temporadaId:'old'})).status,400);
 const r=await post({action:'encerrar',temporadaId:'old',confirmacao:'ENCERRAR'});assert.equal(r.status,200,JSON.stringify(await r.json()));
 const official=JSON.parse(db.prepare("SELECT dados FROM classificacoes_oficiais WHERE temporada_id='old'").get().dados);assert.equal(official.length,60);assert.equal(official[0].total,100);
 for(const sql of ["UPDATE corridas SET pontos=999 WHERE temporada_id='old'","DELETE FROM corridas WHERE temporada_id='old'","UPDATE inscricoes SET serie='B' WHERE piloto_id='SGT001'","UPDATE calendario SET multiplicador=2 WHERE temporada_id='old'","UPDATE temporadas SET total_etapas=3 WHERE id='old'","DELETE FROM classificacoes_oficiais WHERE temporada_id='old'"])assert.throws(()=>db.exec(sql),/protegido|imutável|alterada|indisponível/);
 assert.equal((await post({action:'encerrar',temporadaId:'old',confirmacao:'ENCERRAR'})).status,400);
});
test('assisted transition handles all adjacent divisions and creates a separate planned membership only after confirmation',async()=>{
 const official=JSON.parse(db.prepare("SELECT dados FROM classificacoes_oficiais WHERE temporada_id='old'").get().dados);
 assert.equal(official.filter(r=>r.serie==='A'&&r.destino==='B').length,5);assert.equal(official.filter(r=>r.serie==='B'&&r.destino==='A').length,5);assert.equal(official.filter(r=>r.serie==='C'&&r.destino==='D').length,5);assert.equal(official.filter(r=>r.serie==='D'&&r.destino==='C').length,5);
 const roster=official.map(r=>({pilotoId:r.pilotoId,serie:r.destino,motivo:''}));
 assert.equal((await post({action:'nova',anteriorId:'old',nome:'Nova',roster})).status,400);
 assert.equal((await post({action:'nova',anteriorId:'old',nome:'Nova',roster:[...roster,roster[0]],confirmacao:true})).status,400);
 const response=await post({action:'nova',anteriorId:'old',nome:'Nova',roster,confirmacao:true});const j=await response.json();assert.equal(response.status,200,JSON.stringify(j));
 assert.equal(db.prepare('SELECT ciclo FROM temporadas WHERE id=?').get(j.id).ciclo,'planejada');assert.equal(db.prepare('SELECT count(*) n FROM inscricoes WHERE temporada_id=?').get(j.id).n,60);assert.equal(db.prepare('SELECT count(*) n FROM pilotos').get().n,60);assert.equal(db.prepare("SELECT serie FROM inscricoes WHERE temporada_id='old' AND piloto_id='SGT011'").get().serie,'A');assert.equal(db.prepare('SELECT serie FROM inscricoes WHERE temporada_id=? AND piloto_id=?').get(j.id,'SGT011').serie,'B');
 assert.equal((await post({action:'nova',anteriorId:'old',nome:'Outra',roster,confirmacao:true})).status,400);
 assert.throws(()=>db.prepare('INSERT INTO corridas(temporada_id,etapa,piloto_id,pontos) VALUES(?,1,?,0)').run(j.id,'SGT001'),/Ative/);
});
test('logs retain old and new values and read/write APIs reject unapproved access',async()=>{
 const log=db.prepare("SELECT anterior,novo FROM atividades WHERE entidade='temporadas' AND acao='alterou' LIMIT 1").get();assert.equal(JSON.parse(log.anterior).ciclo,'ativa');assert.equal(JSON.parse(log.novo).ciclo,'encerrada');
 allowed=false;assert.equal((await admin.GET(new Request('http://local/api/admin'))).status,403);assert.equal((await ledger.GET()).status,403);assert.equal((await post({action:'usuario',id:1,ativo:false})).status,403);
});
