import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';

const db=new DatabaseSync(':memory:');
const journal=JSON.parse(fs.readFileSync(new URL('../drizzle/meta/_journal.json',import.meta.url),'utf8'));
for(const entry of journal.entries){
  const sql=fs.readFileSync(new URL(`../drizzle/${entry.tag}.sql`,import.meta.url),'utf8');
  db.exec(sql);
}
db.exec(`INSERT INTO temporadas(id,nome,ativa,total_etapas,pilotos_por_serie) VALUES ('test','Teste',1,2,15);
INSERT INTO divisoes(temporada_id,codigo,nome,ordem,aberto_suplentes) VALUES ('test','A','Série A',1,1),('test','B','Série B',2,0);
INSERT INTO calendario(temporada_id,etapa,pista,multiplicador) VALUES ('test',1,'Interlagos',1),('test',2,'Spa',2);
INSERT INTO pilotos(id,apelido) VALUES ('SGT001','Titular'),('SGT002','Suplente'),('SGT003','Outro');
INSERT INTO inscricoes(temporada_id,piloto_id,serie,situacao) VALUES ('test','SGT001','A','ativo'),('test','SGT002','A','suplente'),('test','SGT003','B','ativo');`);
let access={papel:'administrador',serie:null};
let signedIn=true;
const binding={prepare(sql){const statement=db.prepare(sql);let values=[];return {bind(...args){values=args;return this},async first(){return statement.get(...values)??null},async all(){return {results:statement.all(...values)}},async run(){const r=statement.run(...values);return {meta:{changes:r.changes}}}}},async batch(statements){db.exec('BEGIN');try{for(const statement of statements)await statement.run();db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}}};
globalThis.__speedTest={getChatGPTUser:async()=>signedIn?{id:'test'}:null,ensureCurrentUserAccess:async()=>access,getD1Binding:()=>binding};
async function moduleFrom(file){let source=fs.readFileSync(new URL(file,import.meta.url),'utf8');source=source.replace('import { seedData } from "@/db/seed-data";','const seedData=globalThis.__speedTest.seedData;');source=source.replace(/^import .* from "@\/(?:app\/chatgpt-auth|db|db\/access)";\r?\n/gm,'').replace('import { calculateRacePoints } from "@/db/scoring";',`const {calculateRacePoints}=globalThis.__speedTest;`);source='const {getChatGPTUser,ensureCurrentUserAccess,getD1Binding}=globalThis.__speedTest;\n'+source;const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));}
globalThis.__speedTest.seedData={pontuacao:new Map(fs.readFileSync(new URL('../seed/pontuacao.csv',import.meta.url),'utf8').trim().split(/\r?\n/).slice(1).map(line=>line.split(',').map(Number)))};
globalThis.__speedTest.calculateRacePoints=(await moduleFrom('../db/scoring.ts')).calculateRacePoints;
const race=await moduleFrom('../app/api/corridas/route.ts');
const cash=await moduleFrom('../app/api/caixa-configuracao/route.ts');
const row=(id,pos,extra={})=>({pilotoId:id,confirmou:true,faltaJustificada:null,posicaoFinal:pos,voltaMaisRapida:false,ausente:false,punicao:null,abandonoMotivo:null,observacao:null,carro:null,fabricante:null,origemCarro:null,pontosSuplente:null,...extra});
const post=(results,extra={})=>race.POST(new Request('http://local/api/corridas',{method:'POST',body:JSON.stringify({temporadaId:'test',serie:'A',etapa:1,resultados:results,...extra})}));

test('pilot listing includes payments without enrollment and isolates seasons',()=>{
 db.exec(`INSERT INTO temporadas(id,nome,ativa,total_etapas,pilotos_por_serie) VALUES ('other','Outra',0,2,15);
 INSERT INTO pilotos(id,apelido) VALUES ('SGT004','Sem série');
 INSERT INTO caixa(temporada_id,data,piloto_id,nome,tipo,valor) VALUES
 ('test','2026-09-04','SGT004','Sem série','inscricao',1000),
 ('test','2026-09-04','SGT004','Sem série','inscricao',2000),
 ('other','2026-09-04','SGT004','Sem série','inscricao',5000);`);
 const source=fs.readFileSync(new URL('../db/pilots.ts',import.meta.url),'utf8');
 const sql=[...source.matchAll(/`(SELECT[\s\S]*?)`/g)].map(m=>m[1]).find(s=>s.includes('FROM pilotos p'));
 assert.ok(sql);
 const rows=db.prepare(sql).all('test','test');
 const pilot=rows.find(p=>p.id==='SGT004');
 assert.equal(pilot.serie,null);
 assert.equal(pilot.total_pago,3000);
 assert.equal(rows.find(p=>p.id==='SGT003').total_pago,0);
});

test('saves and reloads a called reserve without promoting their membership',async()=>{
 const r=await post([row('SGT001',1),row('SGT002',2,{pontosSuplente:18})]);assert.equal(r.status,200);
 const stored=db.prepare("SELECT * FROM corridas WHERE piloto_id='SGT002'").get();assert.equal(stored.suplente,1);assert.equal(stored.pontos,18);assert.equal(stored.pontos_suplente,18);
 assert.equal(db.prepare("SELECT situacao FROM inscricoes WHERE piloto_id='SGT002'").get().situacao,'suplente');
});
test('removing a called reserve removes only that reserve result',async()=>{
 assert.equal((await post([row('SGT001',1)])).status,200);assert.equal(db.prepare("SELECT count(*) n FROM corridas WHERE piloto_id='SGT002'").get().n,0);
 assert.equal(db.prepare("SELECT count(*) n FROM corridas WHERE piloto_id='SGT001'").get().n,1);
});
test('closed divisions, duplicates, invalid scores, missing regular pilots and other divisions are rejected',async()=>{
 db.exec("UPDATE divisoes SET aberto_suplentes=0 WHERE codigo='A'");
 assert.equal((await post([row('SGT001',1),row('SGT002',2)])).status,400);
 db.exec("UPDATE divisoes SET aberto_suplentes=1 WHERE codigo='A'");
 for(const rows of [[row('SGT001',1),row('SGT002',1)],[row('SGT001',1,{pontosSuplente:99})],[row('SGT001',1),row('SGT002',2,{pontosSuplente:-1})],[row('SGT002',1)],[row('SGT001',1),row('SGT003',2)]])assert.equal((await post(rows)).status,400);
 assert.equal(db.prepare('SELECT count(*) n FROM corridas').get().n,1);
});
test('coordinators cannot write another division or cash settings',async()=>{
 access={papel:'coordenador',serie:'B'};assert.equal((await post([row('SGT001',1)])).status,403);
 assert.equal((await cash.GET(new Request('http://local/api/caixa-configuracao?temporadaId=test'))).status,403);
 access={papel:'administrador',serie:null};
});
test('cash values persist by season and invalid money is rejected',async()=>{
 const values={temporadaId:'test',medalhaIndividual:1250,medalhaTemporada:18750,freteIndividual:2000,freteTemporada:30000,saldoCaixa:5000};
 const request=v=>new Request('http://local/api/caixa-configuracao',{method:'POST',body:JSON.stringify(v)});
 assert.equal((await cash.POST(request(values))).status,200);
 const data=await (await cash.GET(new Request('http://local/api/caixa-configuracao?temporadaId=test'))).json();assert.equal(data.config.saldoCaixa,5000);assert.equal(data.config.medalhaIndividual,1250);
 assert.equal((await cash.POST(request({...values,freteIndividual:-5}))).status,400);
 signedIn=false;assert.equal((await post([row('SGT001',1)])).status,401);
});

