# Acesso direto à Central

Login removido por solicitação do responsável. Quem abrir a Central pode
consultar e editar pilotos, pagamentos, temporadas e demais dados.
Não há identificação individual; novas atividades usam o autor “Acesso público”.
As rotas antigas de conta e login encaminham para `/central`.
Supabase Auth e Cloudflare Access não são necessários. Se existir uma política
externa de Access no domínio, ela deve ser removida na hospedagem para liberar
o acesso; esta alteração no código não modifica essa política.
