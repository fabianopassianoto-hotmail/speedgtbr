# Speed GT Brasil — Cloudflare Pages

Versão estática convertida do tema XML do Blogger.

## Deploy
Envie o conteúdo desta pasta para o Cloudflare Pages. O arquivo de entrada é `index.html`.

Não há processo de build obrigatório.

## Páginas independentes

A página inicial contém a apresentação. Cada item interno do menu tem sua própria pasta com `index.html`: `por-que`, `comece-aqui`, `regras`, `temporada-3`, `hall-da-fama`, `organizadores`, `apoie`, `depoimentos` e `campeonatos`.

Edite o conteúdo no HTML da página correspondente. CSS e JavaScript são compartilhados em `assets/`. Cabeçalho e rodapé estão presentes em todas as páginas; alterações nesses trechos devem ser replicadas nos dez arquivos HTML. Não é necessário build. Publique a pasta completa no Cloudflare Pages. O item Recursos mantém o portal externo. Links antigos da página inicial são encaminhados pelo JavaScript.

## Campeonatos ativos (branch frame)

`/campeonatos/` reúne as Séries A, B e C, com âncoras `#serie-a`, `#serie-b` e `#serie-c`. `/temporada-3/` continua sendo o regulamento. O menu compartilhado nos dez HTMLs usa dropdowns nativos (`details/summary`) e passa para o menu móvel abaixo de 1200px. Funciona por clique e teclado, fecha com Escape/clique externo e usa disclosure nativo no desktop mesmo sem JavaScript.

### Integração com SimGrid

Em 09/09/2026, a requisição direta recebeu HTTP 403, `cf-mitigated: challenge` e `X-Frame-Options: SAMEORIGIN`. Esses cabeçalhos são da resposta de proteção; não foi possível confirmar os cabeçalhos da página normal. Por isso não incorporamos um iframe que poderia ficar bloqueado. Também não foi identificada uma API JSON pública documentada para estes campeonatos.

`functions/api/championships/[id].js` é uma Cloudflare Pages Function que consulta somente os três IDs autorizados. Extrai título e descrição públicos com HTMLRewriter e devolve JSON, com timeout de 8 segundos e cache de 5 minutos. Não contorna a proteção do SimGrid. Se houver bloqueio, erro, redirecionamento ou conteúdo inesperado, retorna indisponibilidade. O navegador mostra um aviso e preserva os links oficiais. Nenhum HTML externo é inserido na página.

Esta primeira integração traz **somente o resumo público**, quando o SimGrid permite a consulta. Não importa calendário, pilotos ou classificação; esses dados continuam disponíveis no SimGrid. O funcionamento da consulta a partir da Cloudflare precisa ser confirmado em preview. Se o bloqueio persistir, uma integração mais completa depende de uma API/exportação autorizada pelo SimGrid.

### Como testar e publicar

1. Para testar o site estático: `python -m http.server 8080` e abrir `http://localhost:8080/campeonatos/`. Nesse modo, a consulta da API cai no aviso de indisponibilidade; os links e menus continuam funcionando.
2. Para testar também a Function: `npx wrangler pages dev .` e abrir a URL local informada. Consultar `/api/championships/26971`, `26974` e `26975`: sucesso traz título, descrição e horário; bloqueio retorna HTTP 503 com `status: unavailable`. Um ID desconhecido retorna 404.
3. Conferir as dez páginas, os dropdowns com Tab/Enter/Escape, clique externo e menu móvel. Testar larguras 390, 768, 1024, 1280 e 1440px. Os links Série A/B/C devem levar ao cartão correto.
4. Publicar por integração Git do Cloudflare Pages ou `npx wrangler pages deploy .`, que inclui `functions/`. Upload apenas dos arquivos estáticos pelo painel não instala Pages Functions; nesse caso os cartões funcionam com o aviso e os links oficiais. Não há build obrigatório e nenhuma publicação é realizada por estas alterações.
