import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

async function load(file, replacements = []) {
  let source = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
  for (const [from, to] of replacements) source = source.replace(from, to);
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
}
test('anonymous access can administer the Central without account records or a login provider', async () => {
  const auth = await load('../app/chatgpt-auth.ts');
  const access = await load('../db/access.ts', [
    ['import { setAuditActor } from "@/db/audit-context";', 'const setAuditActor = () => {};'],
    ['import { getD1Binding } from "@/db";', 'const getD1Binding = () => { throw new Error("Public access must not query account records"); };'],
  ]);
  const user = await auth.requireChatGPTUser('/central');
  assert.equal(user.id, 'central-public');
  const permission = await access.ensureCurrentUserAccess(user);
  assert.equal(permission.papel, 'administrador');
  assert.equal(permission.ativo, true);
  assert.equal(permission.email, 'Acesso público');
});
