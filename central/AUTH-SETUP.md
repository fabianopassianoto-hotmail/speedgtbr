# Ativação do login próprio

A integração está preparada, mas não está ativa: o proprietário informou não possuir projeto Supabase.

1. Criar um projeto Supabase com Auth por e-mail/senha e confirmação de e-mail obrigatória. Não criar nem transferir tabelas da liga; elas permanecem no D1.
2. Configurar o endereço da Central como Site URL e permitir `/conta` como URL de retorno de confirmação/recuperação. Ao hospedar fora de Sites, atualizar essas URLs para o domínio final.
3. Configurar envio de e-mails e limites de autenticação no provedor. Ativar proteção contra abuso adequada ao cadastro público.
4. Cadastrar o administrador inicial com o mesmo e-mail já aprovado na Central e confirmar o e-mail. As autorizações existentes são preservadas por e-mail verificado; nunca pelo nome informado no cadastro.
5. Configurar `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` nas variáveis da hospedagem. Ambas as variáveis são públicas; nunca usar service_role para este fluxo.
6. Validar confirmação, aprovação de uma nova conta, bloqueio, login, logout, recuperação e alteração de senha. O login por ChatGPT só é usado quando essas variáveis não estão configuradas.

Cookies de acesso/renovação são HttpOnly, Secure e SameSite=Lax. Identidade é validada no Auth a cada acesso protegido; aprovação e bloqueio são consultados no D1. A renovação é feita por `/central/api/auth/refresh`. Senhas são encaminhadas por HTTPS ao provedor e nunca armazenadas no banco da liga.

Referências: https://supabase.com/docs/guides/auth/server-side e https://supabase.com/docs/reference/api/auth.

## Exportação para Cloudflare

Use `/central/conta` para os callbacks de confirmação e recuperação, e
`/central/entrar` para login. Cadastre as URLs completas do seu domínio no Supabase.
Sem Supabase, o projeto mantém Cloudflare Access. Nunca use os endpoints
`signin-with-chatgpt` fora do Sites.
