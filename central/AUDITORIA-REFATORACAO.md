# Auditoria — Speed GT Brasil

Base auditada: versão publicada 33, commit 780d035. Nenhuma alteração de dados foi executada para esta auditoria.

## Preservar

- React 19, Vinext, Cloudflare Worker, D1/SQLite e Drizzle; mesmo projeto e banco.
- Cadastro permanente em `pilotos`; participação em `inscricoes`, com chave composta temporada/piloto. Não criar cadastros duplicados.
- Competições em `temporadas`, séries em `divisoes`, calendário e resultados em `calendario`/`corridas`; pontuação, descarte, faltas, suplentes, boletins e exportações existentes.
- Pagamentos em `caixa`, configurações financeiras, fila e formulários públicos. O formulário `/cadastro` permanece público.
- Ficha lateral, edição, desfazer, arquivamento e controles de inscrição existentes.

## Reorganizar

- Navegação: Início, Pilotos, Corrida, Classificação, Caixa, Administração.
- Entrada integra formulários, fila e cadastros incompletos em Pilotos.
- Configuração de competição, calendário, grids, usuários e configurações financeiras passam para Administração.
- Home prioriza próxima etapa, ações pendentes, presença, formulários e disciplina. Inteligência secundária permanece recolhida.
- Sistema visual escuro com azul para ações; verde para sucesso, vermelho para risco e âmbar para atenção.

## Entidades e dependências

A base já modela a separação pessoa/participação. Porém há referências fixas à temporada 2026 em consultas, pagamentos e composição esportiva. O novo fluxo precisa usar a temporada selecionada/ativa sem reescrever participações históricas.

`caixa` exige temporada e possui valor positivo e reserva calculada para medalhas. Alterar essa tabela obrigaria a reconstruí-la. Um livro-caixa complementar com vínculos opcionais preserva todos os pagamentos originais e permite consolidar receitas/despesas sem duplicar registros.

O estado existente das temporadas aceita ativa, arquivada ou cancelada. Uma coluna adicional de ciclo evita reconstrução da tabela para acrescentar planejada/encerrada. A classificação oficial será um registro persistente no encerramento, calculado com a mesma função esportiva existente. Alterações esportivas posteriores serão bloqueadas no banco.

Histórico esportivo: derivar das inscrições/resultados enquanto a competição estiver aberta; usar a classificação oficial congelada após encerramento. Promoção/rebaixamento usa cinco primeiros/últimos por ordem das divisões, com revisão de empates, exceções, desistências e capacidade antes de confirmar.

## Autenticação e segurança

Atualmente a Central usa identidade encaminhada pelo ChatGPT e autorização nas tabelas `usuarios_acessos`/`solicitacoes_acesso`. O site é público no nível de hospedagem para permitir o cadastro de pilotos; a Central e suas APIs verificam acesso no servidor.

Supabase Auth é compatível por HTTPS, sem transferir dados da liga para outro banco. Não há projeto Supabase nem variáveis configuradas; a ativação real depende desse provisionamento. Preparar login/cadastro/recuperação/alteração/logout e manter a autenticação atual até configurar o provedor. Não armazenar senhas no D1. Novos usuários exigem aprovação e contas bloqueadas são recusadas no servidor.

Logs: registrar ações administrativas com usuário, horário, entidade, identificador e estados anterior/novo. Executar atribuição e alteração no mesmo lote transacional, com gatilhos SQLite para cobrir operações antigas e novas.

## Validação necessária

Inspecionar migração exclusivamente aditiva; verificar preservação dos dados e bloqueio do histórico encerrado, transição revisada, totais financeiros, autorização e regressões esportivas. Conferir navegação, ficha e formulários em desktop/mobile. A conexão real de autenticação externa exige dados do provedor.
