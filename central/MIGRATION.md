# Migração — Speed GT Brasil

## Atualização da exportação — 11 de setembro de 2026

Código atualizado para a versão **33** do Sites, commit
`780d035f46e5db29561da39fcde26f0ecf0b6376`, preservando o tema azul,
a autenticação Cloudflare Access e as rotas em `/central` deste repositório.
Inclui a tela pública `/central/cadastro`, sua API, introdução e imagens,
além dos novos controles de inscrições e pagamentos.

Esta atualização exporta código, assets, esquema e migrations. Não contém
um novo backup dos registros do banco hospedado, nem credenciais. Os backups
citados abaixo pertencem à exportação inicial e não estão versionados no Git.

## Escopo do pacote inicial

Este pacote foi criado a partir da versão publicada **32** do ChatGPT Sites, commit
`2f2dc7c29012a10825df7b8587f3410709e619f6`, em 8 de setembro de 2026.

Ele contém:

- frontend e backend completos;
- componentes React/Vinext;
- rotas de API;
- estilos, fontes declaradas e assets públicos;
- `package.json` e `package-lock.json`;
- esquema Drizzle e 14 migrations SQL;
- backup dos dados atuais do D1 em JSON e SQL;
- configuração de exemplo para Cloudflare Workers;
- adaptação de autenticação para Cloudflare Access;
- adaptação para servir a aplicação em `/central`.

O Site publicado no ChatGPT não foi editado, salvo novamente nem republicado.

## Arquitetura

| Camada | Tecnologia |
| --- | --- |
| Interface | React 19.2.6 + Next 16.2.6 |
| Runtime/adapter | Vinext 0.0.50 + Vite 8.0.13 |
| Backend | React Server Components e Route Handlers em `app/api` |
| Hospedagem de destino | Cloudflare Workers com assets estáticos |
| Banco | Cloudflare D1, binding lógico `DB` |
| ORM/schema | Drizzle ORM 0.45.2 / Drizzle Kit 0.31.10 |
| Autenticação original | Sign in with ChatGPT e headers `oai-*` |
| Autenticação no pacote | Cloudflare Access pelo header `cf-access-authenticated-user-email` |
| Armazenamento de arquivos | Nenhum R2 configurado |

O código do Worker compilado é gerado em `dist/server/index.js`; os assets são
gerados em `dist/client`. O script de build também espelha os assets dentro de
`dist/client/central`, necessário para servir o aplicativo no caminho
`/central`.

## Pré-requisitos

- Node.js 22.13 ou superior;
- npm;
- conta Cloudflare com Workers, D1 e Zero Trust/Access;
- domínio gerenciado pela Cloudflare para usar `SEU_DOMINIO/central`;
- Wrangler autenticado (`npx wrangler login`) apenas para criar/migrar/deployar.

## Desenvolvimento local

Na pasta deste projeto:

```bash
npm install
cp .env.example .env.local
```

Edite `.env.local` e defina `DEV_AUTH_EMAIL` com um e-mail presente em
`usuarios_acessos`. Para iniciar com uma cópia dos dados atuais:

```bash
npm run db:migrate:local
npm run db:import:local
npm run dev
```

Acesse `http://localhost:5173/central`.

Sem o import, o sistema pode iniciar um banco local vazio pelo bootstrap da
aplicação. O arquivo `.env.local` não deve ser commitado.

## Build

```bash
npm run build
```

Saídas principais:

- `dist/server/index.js`;
- `dist/client/`;
- `dist/client/central/`.

## Criar e restaurar o D1

Crie o banco:

```bash
npx wrangler d1 create speed-gt-brasil-db
```

Copie o `database_id` retornado e substitua o ID placeholder
`00000000-0000-4000-8000-000000000000` em `wrangler.jsonc`.

Aplique a estrutura e depois os dados:

```bash
npm run db:migrate:remote
npm run db:import:remote
```

Arquivos de banco incluídos:

- `db/schema.ts`: schema Drizzle;
- `drizzle/*.sql`: migrations de estrutura;
- `drizzle/meta/**`: histórico/snapshots;
- `export/data/d1-data.json`: backup legível das 12 tabelas;
- `export/data/d1-data.sql`: restauração SQL das 238 linhas exportadas.

O SQL usa `INSERT OR REPLACE` e foi preparado para um D1 novo. Faça um backup
antes de executá-lo sobre um banco que já contenha dados.

## Configurar o caminho /central sem substituir o site da raiz

O pacote já usa `basePath: "/central"`. No Cloudflare, associe o Worker à rota:

```text
SEU_DOMINIO/central*
```

Depois, em `wrangler.jsonc`:

1. substitua `https://SEU_DOMINIO/central` pelo endereço real;
2. preencha o ID do D1;
3. opcionalmente adicione a rota real em `routes`, ou configure-a no painel.

O site que já responde na raiz do domínio permanece responsável pelas demais
rotas. Teste especificamente `/central`, `/central/cadastro`,
`/central/api/cadastro` e um asset em `/central/assets/`.

## Autenticação

O login do ChatGPT Sites não é portátil. Este pacote troca a leitura dos headers
`oai-authenticated-user-*` pelo e-mail autenticado do Cloudflare Access.

Configure no Zero Trust:

1. uma aplicação self-hosted protegendo `SEU_DOMINIO/central*`;
2. uma política Allow para os e-mails autorizados;
3. aplicações/regras mais específicas com Bypass para
   `/central/cadastro` e `/central/api/cadastro`, caso o cadastro de pilotos
   deva continuar público.

Rotas específicas têm precedência sobre a regra geral. Um Bypass torna aquela
rota pública; use apenas nos dois endpoints intencionalmente públicos.

O controle de administrador/coordenador continua sendo feito pela tabela
`usuarios_acessos`, usando o e-mail recebido do Access.

## Deploy

Depois de configurar D1, endereço e Access:

```bash
npm run deploy
```

Para integração via GitHub, configure o Cloudflare Workers Builds com:

- repositório: `fabianopassianoto-hotmail/speedgtbr`;
- branch: `central`;
- diretório raiz: a pasta onde este pacote for colocado, recomendada
  `central`;
- comando de build: `npm run build`;
- comando de deploy: `npx wrangler deploy --config wrangler.jsonc`;
- versão do Node: 22.13 ou superior.

Sugestão de estrutura no repositório existente:

```text
speedgtbr/
  ...site atual...
  central/
    package.json
    app/
    components/
    db/
    drizzle/
    wrangler.jsonc
```

## Variáveis de ambiente

| Nome | Onde | Finalidade |
| --- | --- | --- |
| `PUBLIC_BASE_URL` | local e Cloudflare | URL completa, terminando em `/central` |
| `DEV_AUTH_EMAIL` | somente local | simula o e-mail autenticado durante desenvolvimento |
| `DEV_AUTH_NAME` | somente local | nome opcional exibido no desenvolvimento |

Não havia variáveis de ambiente configuradas no ChatGPT Sites no momento do
export. Nenhum token, senha, cookie, credencial temporária ou secret foi incluído.
O ID público do D1 também não foi copiado: o destino deve usar um banco novo.

## O que não é exportável automaticamente

| Item | Motivo | Substituição/ação |
| --- | --- | --- |
| Recurso D1 gerenciado pelo Sites | O recurso pertence à infraestrutura do Sites e não é transferível | Criar novo D1, aplicar migrations e importar o SQL |
| Login do ChatGPT/SIWC | As rotas e cookies são fornecidos pelo dispatcher do Sites | Cloudflare Access, já adaptado no código |
| Políticas de acesso do Site | São configuração da plataforma, não arquivos do projeto | Recriar políticas no Cloudflare Zero Trust |
| URL `maxlima.chatgpt.site` | Domínio administrado pelo ChatGPT Sites | Usar o domínio Cloudflare escolhido |
| Histórico de versões/deploys | Pertence ao serviço Sites | O commit de origem foi registrado acima; Git passa a guardar o novo histórico |
| Credenciais e secrets | Não devem ser exportados | Criar secrets novos no destino, se futuramente necessários |

## Alterações feitas somente nesta cópia

Para permitir a migração sem tocar no Site original, esta cópia recebeu:

- `basePath` `/central`;
- prefixo `/central` nas chamadas de API e assets;
- autenticação compatível com Cloudflare Access;
- `wrangler.jsonc` e `wrangler.local.jsonc`;
- comandos de migration, import e deploy;
- backup dos dados e esta documentação.

O restante do código vem da versão 32 indicada no início deste documento.

## Verificação recomendada antes de trocar tráfego

1. rodar `npm install`;
2. importar o D1 local;
3. rodar `npm test`;
4. confirmar login e permissões de administrador/coordenador;
5. testar cadastro público;
6. comparar totais das 12 tabelas com `export/data/d1-data.json`;
7. publicar primeiro na branch de migração;
8. somente depois associar a rota `/central*`.

O banco exportado contém dados pessoais de pilotos e usuários. Trate o ZIP e o
repositório como privados.
