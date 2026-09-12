# Cadastro de pilotos — ativação e operação

Implementação da issue #1 na branch central_nova.

## Comportamento

Seis grupos: nome, telefone, e-mail, PSN, endereço e classificação GT7 (S, A+, A, B, C, D, E). CEP, rua, número, bairro, cidade e UF obrigatórios; complemento opcional. O e-mail é validado na própria etapa e o endereço é validado separadamente. Demais perguntas removidas apenas do formulário público. Dados históricos preservados.

A confirmação salva o cadastro como pendente, mostra os dados e o aviso de aprovação. Após oito segundos abre o WhatsApp; há botão direto e opção de permanecer na página. Reenviar e-mail pausa o redirecionamento. Aprovar na Central não aprova automaticamente a solicitação no WhatsApp: a administração precisa conferir a configuração de aprovação do grupo.

Os campos novos acompanham a aprovação para pessoa existente, criação de fila e promoção da fila para piloto. A migração é aditiva e não apaga registros. Campos históricos não preenchidos no cadastro novo não sobrescrevem valores antigos.

## Antes de publicar

1. Aplicar `central/drizzle/0014_registration_onboarding.sql` no D1 correto pelo processo de migração existente, antes de colocar o novo Worker no ar. Nenhuma migração remota é aplicada durante a implementação local.
2. Configurar `RESEND_API_KEY` como segredo no ambiente de destino e `REGISTRATION_EMAIL_FROM` com um remetente de domínio verificado no Resend. Não colocar a chave em Git. Em desenvolvimento, usar variáveis locais do Worker; não enviar testes para pilotos reais.
3. Confirmar entrega usando uma caixa de teste autorizada. Sem essas variáveis, cadastro e WhatsApp funcionam, mas o sistema informa que o e-mail não foi confirmado. Resposta de sucesso do provedor indica aceite de envio, não prova de entrega na caixa de entrada.
4. Conferir aprovação de participantes nas configurações do grupo WhatsApp.

O e-mail é transacional, com confirmação, WhatsApp, Instagram, vídeo existente, tutorial escrito e apoio opcional. O remetente e a chave ainda precisam ser configurados no ambiente de destino. Não foram enviados e-mails reais nem feito deploy nesta implementação.

## Reenvio e duplicidade

O navegador cria uma chave aleatória por envio. O servidor armazena essa chave e o hash dos dados; repetir o mesmo envio não duplica o cadastro. O telefone normalizado tem índice único para novos cadastros pendentes, além da verificação de registros históricos.

O reenvio exige a chave do envio, não aceita destinatário livre e usa apenas o e-mail já salvo. Intervalo mínimo de um minuto, com exclusão entre tentativas concorrentes. Após sucesso não reenvia. A chave de idempotência do Resend evita repetição do e-mail em resultados incertos; reenvios limitados a 23 horas após o cadastro. Depois disso orientar contato com administração.

## Links reutilizados do site

- WhatsApp: https://chat.whatsapp.com/Jz9Zg4z1q302rXOlaI8KKk
- Instagram: https://instagram.com/speedgtbr
- Vídeo existente: https://www.youtube.com/watch?v=dI8-pXOOAvc
- Comunidade: https://www.thesimgrid.com/communities/speed-gt-brasil
- Apoio opcional: https://speedgtbrasil.pages.dev/apoie/

A duração/conteúdo integral do vídeo existente não foi auditada. Não foi produzido um vídeo novo. O roteiro abaixo serve para atualização da gravação caso necessário.

## Roteiro de cinco minutos

- 0:00–0:30: explicar que SimGrid será usado para inscrição nos campeonatos, depois da entrada na comunidade.
- 0:30–1:40: mostrar criação ou acesso ao Discord ou Steam. Escolher uma opção, seguir verificação solicitada; não é necessário criar ambas.
- 1:40–3:10: abrir SimGrid, escolher Login or Register, selecionar o serviço escolhido, autorizar conexão e completar o perfil com a mesma PSN do cadastro.
- 3:10–4:20: abrir o link Speed GT Brasil e selecionar Follow Community.
- 4:20–5:00: explicar que o piloto deve aguardar orientações da administração para inscrição no campeonato adequado; seguir a comunidade não equivale à inscrição em uma prova.

Fontes verificadas em 11/09/2026: https://www.thesimgrid.com/?races_count=full_championships (login Discord/Steam); https://resend.com/docs/api-reference/emails/send-email (integração HTTP).

## Validação

Compilar: `npm --prefix central run build`.
Testar: `node --test central/tests/*.test.mjs tests/*.test.mjs` (Node 24 para o SQLite embutido dos testes de cadastro).
Os testes de cadastro usam banco em memória com todas as migrações e simulam o provedor de e-mail. Cobrem validação, falha de gravação, falha de envio, reenvio, duplicidade, aprovação e preservação histórica.

Validação visual concluída em 390 px e 1280 px: seis perguntas, revisão, confirmação e redirecionamento, sem erros no navegador ou rolagem horizontal. Os envios foram simulados no teste visual; a persistência foi testada separadamente em SQLite.

A compilação e os 43 testes passaram. A checagem global de TypeScript ainda aponta problemas preexistentes de tipagem do runtime Cloudflare e de telas de corridas/home. O comando de desenvolvimento original também apresenta limitações locais (flag duplicada e data mais recente que o simulador instalado); a prévia foi validada com o pacote compilado e uma data de compatibilidade sobrescrita apenas no comando local.

## Correção da prévia em 11/09/2026

A publicação automática do commit b4917e0 ocorreu antes de aplicar a migração 0014. O banco speedgtbr-central-preview foi conferido e a migração 0014 foi aplicada, preservando os registros. As consultas de pilotos, fila e formulários dependem dessa migração.

O caminho /central/central passa a redirecionar para /central/cadastro, preservando os parâmetros. Use a URL estável da branch: https://central-nova.speedgtbr.pages.dev/central/cadastro. URLs com identificador de publicação, como c223373a, continuam apontando para aquele pacote específico e não recebem novos commits. A Cloudflare Access protege o domínio da prévia; uma sessão autenticada continua necessária conforme a configuração atual.

## Identidade do e-mail da comunidade

Remetente proposto: Speed GT Brasil <administracao@speedgtbrasil.com.br>. Respostas ao e-mail de cadastro vão para speedgtbr@gmail.com pelo cabeçalho Reply-To, sem depender da criação de uma caixa postal nova. O endereço administracao@ só poderá enviar depois da verificação do domínio no provedor escolhido.

Verificado em 11/09/2026: domínio ativo na conta Cloudflare; Email Routing ainda desativado; nenhuma credencial de envio configurada no Pages. O acesso atual à API recusou consulta de DNS e assinaturas, portanto não foi possível ativar DNS nem confirmar o plano Workers Paid. O envio real continua pendente de configuração do provedor.

Opções: manter Resend (integração existente; plano gratuito sujeito aos limites atuais) ou usar Cloudflare Email Sending (exige Workers Paid para destinatários não previamente verificados). Cloudflare Email Routing pode futuramente encaminhar administracao@speedgtbrasil.com.br para speedgtbr@gmail.com; isso é recebimento e não substitui a configuração de envio.

## Ativação em 12/09/2026

Resend selecionado e configurado na prévia central_nova. SPF, DKIM e MX de retorno confirmados no DNS público. RESEND_API_KEY salva como secret_text no Pages, sem versionar a credencial. Remetente administracao@speedgtbrasil.com.br e Reply-To speedgtbr@gmail.com.

O provedor aceitou um teste real para speedgtbr@gmail.com com o conteúdo completo do cadastro. Aceite de envio não confirma chegada à caixa de entrada; conferir também spam. Esta ativação cobre a prévia; a branch main/produção não foi alterada.

### E-mail HTML

O cadastro envia HTML com versão alternativa em texto. O logo vem do arquivo `Logo.jpg` na raiz, incorporado pelo build e enviado como imagem inline CID pelo Resend; não depende de um endereço público nem do Cloudflare Access. O template está em `lib/registration-email-template.ts`.

A ficha interna de formulários pendentes preserva os campos anteriores, incluindo SimGrid, link do SimGrid, data de nascimento e perfil de pilotagem. Apenas disponibilidade, volante ou controle, carro preferido, pista citada e curiosidade foram retirados da exibição. O menu e a tela Corrida estão desativados na Central; os dados históricos permanecem preservados.
