import { auditContext } from "./audit-context";
import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb() {
  const binding = getD1Binding();

  return drizzle(binding, { schema });
}

export function getD1Binding() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database.",
    );
  }

  const raw=env.DB;
  const originals=new WeakMap<object,any>();
  const context=()=>raw.prepare("INSERT INTO atividade_contexto(id,usuario) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET usuario=excluded.usuario").bind(auditContext.getStore()?.usuario??"Sistema");
  function wrap(statement:any,sql:string):any {
    const mutation=/^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(sql);
    const proxy=new Proxy(statement,{get(target,key){
      if(key==="bind")return(...values:any[])=>wrap(target.bind(...values),sql);
      if(mutation && ["run","first","all"].includes(String(key))) return async(column?:string)=>{
        const results=await raw.batch([context(),target]);const result=results[1];
        return key==="first"?(column?result.results[0]?.[column]??null:result.results[0]??null):result;
      };
      const value=target[key];return typeof value==="function"?value.bind(target):value;
    }}); originals.set(proxy,statement);return proxy;
  }
  return new Proxy(raw,{get(target,key){
    if(key==="prepare")return(sql:string)=>wrap(target.prepare(sql),sql);
    if(key==="batch")return async(statements:any[])=>{const results=await target.batch([context(),...statements.map(s=>originals.get(s)??s)]);return results.slice(1)};
    const value=(target as any)[key];return typeof value==="function"?value.bind(target):value;
  }});
}
