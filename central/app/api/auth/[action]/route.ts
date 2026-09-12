import {cookies} from "next/headers";
import {authConfig,authRequest,providerUser,writeSession,clearSession,AUTH_COOKIE,REFRESH_COOKIE} from "@/lib/auth-provider";
import {ensureCurrentAccessRequest,ensureCurrentUserAccess} from "@/db/access";
export const dynamic="force-dynamic";
type Context={params:Promise<{action:string}>};
export async function GET(request:Request,context:Context){const {action}=await context.params;const url=new URL(request.url),jar=await cookies();
 if(action==="logout"){const token=jar.get(AUTH_COOKIE)?.value;if(authConfig()&&token)await authRequest("logout",{},token).catch(()=>null);return clearSession(new Response(null,{status:303,headers:{Location:authConfig()?"/central/entrar":"/cdn-cgi/access/logout"}}));}
 if(action==="refresh"){try{const token=jar.get(REFRESH_COOKIE)?.value;if(!token)throw new Error();const r=await authRequest("token?grant_type=refresh_token",{refresh_token:token});if(!r.ok)throw new Error();const data=await r.json();return writeSession(new Response(null,{status:303,headers:{Location:"/central"}}),data)}catch{return clearSession(new Response(null,{status:303,headers:{Location:"/central/entrar?expired=1"}}));}}
 return Response.json({error:"Rota inválida."},{status:404});
}
export async function POST(request:Request,context:Context){const {action}=await context.params;if(!authConfig())return Response.json({error:"O login por e-mail depende da configuração do provedor. Use o acesso atual."},{status:503});
 if(request.headers.get("origin")!==new URL(request.url).origin)return Response.json({error:"Origem não autorizada."},{status:403});
 try{const b=await request.json() as any;let response:Response;
 if(action==="session"){if(typeof b.access_token!=="string"||typeof b.refresh_token!=="string")throw new Error("Sessão inválida.");const user=await providerUser(b.access_token);if(!user)throw new Error("Confirme seu e-mail ou solicite um novo link.");return writeSession(Response.json({ok:true}),{...b,expires_in:3600});}
 if(action==="password"){if(typeof b.password!=="string"||b.password.length<12)throw new Error("Use uma senha com pelo menos 12 caracteres.");const token=(await cookies()).get(AUTH_COOKIE)?.value;if(!token||!await providerUser(token))throw new Error("Entre novamente para alterar a senha.");response=await authRequest("user",{password:b.password},token,"PUT");}
 else {if(typeof b.email!=="string"||!/^\S+@\S+\.\S+$/.test(b.email)||b.email.length>254)throw new Error("Informe um e-mail válido.");
 const email=b.email.trim().toLowerCase();
 if(action==="recover"){await authRequest(`recover?redirect_to=${encodeURIComponent(new URL("/central/conta",request.url).href)}`,{email});return Response.json({ok:true,message:"Se o e-mail estiver cadastrado, você receberá as instruções de recuperação."});}
 if(typeof b.password!=="string"||b.password.length<12)throw new Error("Use uma senha com pelo menos 12 caracteres.");
 if(action==="signup"){if(typeof b.name!=="string"||!b.name.trim())throw new Error("Informe seu nome.");response=await authRequest(`signup?redirect_to=${encodeURIComponent(new URL("/central/conta",request.url).href)}`,{email,password:b.password,data:{name:b.name.trim().slice(0,120)}});}
 else if(action==="login")response=await authRequest("token?grant_type=password",{email,password:b.password});else throw new Error("Ação inválida.");
 }
 const j=await response.json() as any;if(!response.ok)throw new Error(action==="login"?"E-mail ou senha inválidos, ou e-mail ainda não confirmado.":"Não foi possível concluir. Verifique os dados ou tente novamente em instantes.");
 if(action==="signup"){
  const u=j.user??j;
  if(u?.id&&u?.email&&(!Array.isArray(u.identities)||u.identities.length))await ensureCurrentAccessRequest({id:`supabase:${u.id}`,email:u.email,fullName:b.name,displayName:b.name});
  return Response.json({ok:true,message:"Cadastro recebido. Seu acesso será liberado após aprovação. Confira também seu e-mail para confirmar a conta."});
 }
 if(action==="login"){const user=await providerUser(j.access_token);if(!user)throw new Error("Confirme seu e-mail antes de entrar.");const access=await ensureCurrentUserAccess(user);if(!access)await ensureCurrentAccessRequest(user);return writeSession(Response.json({ok:true}),j);}
 return Response.json({ok:true,message:"Senha alterada com sucesso."});
 }catch(e){return Response.json({error:e instanceof Error?e.message:"Não foi possível concluir."},{status:400});}
}
