CREATE TABLE `formularios_pendentes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`criado_em` text NOT NULL,
	`nome_completo` text NOT NULL,
	`psn` text,
	`simgrid` text,
	`simgrid_url` text,
	`whatsapp` text NOT NULL,
	`email` text,
	`cidade` text,
	`uf` text,
	`volante_ou_controle` text,
	`perfil_pilotagem` text,
	`disponibilidade` text,
	`carro_preferido` text,
	`pista_citada` text,
	`status` text DEFAULT 'pendente' NOT NULL,
	`revisado_em` text,
	`destino_tipo` text,
	`destino_id` text,
	CONSTRAINT "ck_formularios_pendentes_status" CHECK("formularios_pendentes"."status" IN ('pendente', 'aplicado', 'descartado'))
);
--> statement-breakpoint
CREATE INDEX `idx_formularios_pendentes_status_criado_em` ON `formularios_pendentes` (`status`,`criado_em`);--> statement-breakpoint
CREATE INDEX `idx_formularios_pendentes_whatsapp` ON `formularios_pendentes` (`whatsapp`);--> statement-breakpoint
ALTER TABLE `fila` ADD `simgrid_url` text;--> statement-breakpoint
ALTER TABLE `fila` ADD `volante_ou_controle` text;--> statement-breakpoint
ALTER TABLE `fila` ADD `perfil_pilotagem` text;--> statement-breakpoint
ALTER TABLE `fila` ADD `disponibilidade` text;--> statement-breakpoint
ALTER TABLE `fila` ADD `carro_preferido` text;--> statement-breakpoint
ALTER TABLE `fila` ADD `pista_citada` text;--> statement-breakpoint
ALTER TABLE `fila` ADD `relacoes` text;--> statement-breakpoint
ALTER TABLE `fila` ADD `curiosidade` text;--> statement-breakpoint
ALTER TABLE `fila` ADD `observacoes_adm` text;--> statement-breakpoint
ALTER TABLE `fila` ADD `ativo` integer;--> statement-breakpoint
ALTER TABLE `fila` ADD `cadastro_status` text;--> statement-breakpoint
ALTER TABLE `fila` ADD `promovido_para_piloto_id` text REFERENCES pilotos(id);--> statement-breakpoint
CREATE INDEX `idx_fila_promovido_para_piloto_id` ON `fila` (`promovido_para_piloto_id`);--> statement-breakpoint
ALTER TABLE `pilotos` ADD `cadastro_status` text;