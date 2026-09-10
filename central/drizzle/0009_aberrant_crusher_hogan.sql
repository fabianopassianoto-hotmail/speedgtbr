CREATE TABLE `solicitacoes_acesso` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_user_id` text NOT NULL,
	`email` text NOT NULL,
	`nome` text,
	`status` text DEFAULT 'pendente' NOT NULL,
	`criado_em` text NOT NULL,
	`revisado_em` text,
	`revisado_por` text,
	CONSTRAINT "ck_solicitacoes_acesso_status" CHECK("solicitacoes_acesso"."status" IN ('pendente', 'aprovado', 'negado'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_solicitacoes_acesso_account_user_id` ON `solicitacoes_acesso` (`account_user_id`);--> statement-breakpoint
CREATE INDEX `idx_solicitacoes_acesso_status_criado_em` ON `solicitacoes_acesso` (`status`,`criado_em`);