import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import ts from 'typescript';
const moduleUrl = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');
const registrationUrl = moduleUrl(readFileSync(new URL('../lib/registration.ts',import.meta.url),'utf8'));
const {validateRegistration,registrationSummary,welcomeEmailText} = await import(registrationUrl);
const valid = {nomeCompleto:'Piloto Teste',whatsapp:'11912345678',email:'piloto@example.com',psn:'Piloto_Teste',cidade:'São Paulo',uf:'SP',classificacaoGt7:'A+',rua:'Rua Teste',numero:'10',bairro:'Centro',cep:'01001-000',complemento:''};
function database() {
  const sqlite = new DatabaseSync(':memory:');
  for (const name of readdirSync(new URL('../drizzle/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort()) sqlite.exec(readFileSync(new URL('../drizzle/'+name,import.meta.url),'utf8'));
  const db = {prepare(sql) { const statement = sqlite.prepare(sql); let args=[]; return {bind(...v){args=v;return this},async first(){return statement.get(...args)??null},async all(){return {results:statement.all(...args)}},async run(){return {meta:{changes:statement.run(...args).changes}}}}}};
  db.batch = async statements => { sqlite.exec('BEGIN'); try { const results=[];for(const statement of statements) results.push(await statement.run());sqlite.exec('COMMIT');return results; } catch(error) {sqlite.exec('ROLLBACK');throw error;} };
  return {sqlite,db};
}
async function loadRoute(db, mail=async()=> 'failed') {
  globalThis.registrationTestDB=db;globalThis.registrationTestMail=mail;
  const source=readFileSync(new URL('../app/api/cadastro/route.ts',import.meta.url),'utf8')
    .replace('import { getD1Binding } from "@/db";', 'const getD1Binding = () => globalThis.registrationTestDB;')
    .replace('"@/lib/registration"',JSON.stringify(registrationUrl))
    .replace('import { sendRegistrationEmail } from "@/lib/registration-email";', 'const sendRegistrationEmail = (...args) => globalThis.registrationTestMail(...args);');
  return (await import(moduleUrl(source))).POST;
}
const request=body=>new Request('https://example.com/central/api/cadastro',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});

test('validates six groups and accepts every requested GT7 rating without legacy questions',()=>{
  for(const rating of ['S','A+','A','B','C','D','E']) assert.equal(validateRegistration({...valid,classificacaoGt7:rating}),null);
  for(const changed of [{email:''},{psn:''},{uf:'XX'},{cep:'123'},{classificacaoGt7:'Z'}]) assert.ok(validateRegistration({...valid,...changed}));
  assert.equal(registrationSummary(valid).length,6);
  assert.match(welcomeEmailText('Piloto'),/Jz9Zg4z1q302rXOlaI8KKk/);
  assert.match(welcomeEmailText('Piloto'),/dI8-pXOOAvc/);
});
test('saves once, survives email failure, retries idempotently and rejects mismatched replay',async()=>{
  const {sqlite,db}=database();const post=await loadRoute(db,async()=>{throw new Error('email offline')});
  const body={...valid,submissionId:crypto.randomUUID(),privacyAccepted:true};
  assert.equal((await post(request(null))).status,400);
  assert.equal((await post(request({...body,privacyAccepted:false}))).status,400);
  const response=await post(request(body)); assert.equal(response.status,200);assert.equal((await response.json()).emailStatus,'failed');
  const saved=sqlite.prepare('SELECT * FROM formularios_pendentes').get();
  assert.equal(saved.classificacao_gt7,'A+');assert.equal(saved.rua,'Rua Teste');assert.equal(saved.data_nascimento,null);assert.equal(saved.status,'pendente');
  assert.equal((await post(request(body))).status,200);
  assert.equal((await post(request({...body,psn:'Different'}))).status,409);
  assert.equal((await post(request({...body,submissionId:crypto.randomUUID()}))).status,409);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM formularios_pendentes').get().count,1);
  sqlite.close();
});
test('does not report success or send mail when persistence fails',async()=>{
  const {sqlite,db}=database();sqlite.exec('DROP TABLE formularios_pendentes');let mailCalls=0;
  const post=await loadRoute(db,async()=>{mailCalls++;return 'sent'});
  const response=await post(request({...valid,submissionId:crypto.randomUUID(),privacyAccepted:true}));
  assert.equal(response.status,503);assert.equal(mailCalls,0);sqlite.close();
});
test('email delivery uses stored recipient, throttles retries and skips already sent mail',async()=>{
  const {sqlite,db}=database();const key=crypto.randomUUID();
  sqlite.prepare("INSERT INTO formularios_pendentes(criado_em,nome_completo,whatsapp,email,submission_key) VALUES(?,?,?,?,?)").run(new Date().toISOString(),'Piloto','11912345678','piloto@example.com',key);
  globalThis.registrationMailEnv={RESEND_API_KEY:'test-key',REGISTRATION_EMAIL_FROM:'Speed <sender@example.com>'};
  const source=readFileSync(new URL('../lib/registration-email.ts',import.meta.url),'utf8').replace('import { env } from "cloudflare:workers";','const env = globalThis.registrationMailEnv;').replace('"./registration"',JSON.stringify(registrationUrl));
  const {sendRegistrationEmail}=await import(moduleUrl(source));
  const originalFetch=globalThis.fetch;let calls=0;
  globalThis.fetch=async(_url,options)=>{calls++;assert.deepEqual(JSON.parse(options.body).to,['piloto@example.com']);assert.equal(options.headers['Idempotency-Key'],'registration-'+key);return new Response('',{status:calls===1?503:200})};
  try {
    assert.equal(await sendRegistrationEmail(db,key),'failed');
    assert.equal(await sendRegistrationEmail(db,key),'pending');assert.equal(calls,1);
    sqlite.prepare('UPDATE formularios_pendentes SET email_attempt_at = 0').run();
    assert.equal(await sendRegistrationEmail(db,key),'sent');
    assert.equal(await sendRegistrationEmail(db,key),'sent');assert.equal(calls,2);
  } finally {globalThis.fetch=originalFetch;sqlite.close()}
});

test('approval copies address and rating and preserves historical data during merge',async()=>{
  const {sqlite,db}=database();const post=await loadRoute(db);
  await post(request({...valid,submissionId:crypto.randomUUID(),privacyAccepted:true}));
  globalThis.registrationTestDB=db;
  const source=readFileSync(new URL('../app/api/formularios/[id]/aprovar/route.ts',import.meta.url),'utf8')
    .replace('import { getD1Binding } from "@/db";', 'const getD1Binding = () => globalThis.registrationTestDB;')
    .replace('import { getChatGPTUser } from "@/app/chatgpt-auth";', 'const getChatGPTUser = async () => ({email:"admin@example.com"});')
    .replace('import { ensureCurrentUserAccess } from "@/db/access";', 'const ensureCurrentUserAccess = async () => ({papel:"administrador"});');
  const approve=(await import(moduleUrl(source))).POST;
  sqlite.prepare('INSERT INTO pilotos(id,apelido,simgrid,data_nascimento) VALUES(?,?,?,?)').run('SGT001','Piloto','Legacy SimGrid','1990-01-01');
  const response=await approve(request({action:'aplicar',targetKind:'piloto',targetId:'SGT001'}),{params:Promise.resolve({id:'1'})});
  assert.equal(response.status,200);
  const pilot=sqlite.prepare('SELECT * FROM pilotos WHERE id=?').get('SGT001');
  assert.equal(pilot.rua,valid.rua);assert.equal(pilot.classificacao_gt7,'A+');assert.equal(pilot.simgrid,'Legacy SimGrid');assert.equal(pilot.data_nascimento,'1990-01-01');
  await post(request({...valid,whatsapp:'11912345679',submissionId:crypto.randomUUID(),privacyAccepted:true}));
  assert.equal((await approve(request({action:'nova_fila',apelido:'Piloto'}),{params:Promise.resolve({id:'2'})})).status,200);
  const queue=sqlite.prepare('SELECT * FROM fila').get();assert.equal(queue.classificacao_gt7,'A+');assert.equal(queue.cep,valid.cep);
  sqlite.close();
});
