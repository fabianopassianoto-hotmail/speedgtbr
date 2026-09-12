import { AsyncLocalStorage } from "node:async_hooks";
export const auditContext = new AsyncLocalStorage<{usuario:string}>();
export function setAuditActor(usuario:string){const context=auditContext.getStore();if(context)context.usuario=usuario;}
