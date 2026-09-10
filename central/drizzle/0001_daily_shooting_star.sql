CREATE TABLE `usuarios_acessos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_user_id` text,
	`email` text NOT NULL,
	`nome` text,
	`papel` text NOT NULL,
	`serie` text,
	`ativo` integer DEFAULT true NOT NULL,
	CONSTRAINT "ck_usuarios_acessos_papel" CHECK("usuarios_acessos"."papel" IN ('administrador', 'coordenador')),
	CONSTRAINT "ck_usuarios_acessos_serie" CHECK("usuarios_acessos"."serie" IS NULL OR "usuarios_acessos"."serie" IN ('A', 'B', 'C'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_usuarios_acessos_account_user_id` ON `usuarios_acessos` (`account_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_usuarios_acessos_email` ON `usuarios_acessos` (`email`);--> statement-breakpoint
CREATE INDEX `idx_usuarios_acessos_papel_serie` ON `usuarios_acessos` (`papel`,`serie`);