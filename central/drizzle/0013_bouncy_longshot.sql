CREATE TABLE `caixa_configuracao` (
	`temporada_id` text PRIMARY KEY NOT NULL,
	`medalha_individual` integer DEFAULT 0 NOT NULL,
	`medalha_temporada` integer DEFAULT 0 NOT NULL,
	`frete_individual` integer DEFAULT 0 NOT NULL,
	`frete_temporada` integer DEFAULT 0 NOT NULL,
	`saldo_caixa` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`temporada_id`) REFERENCES `temporadas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `divisoes` ADD `aberto_suplentes` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `corridas` ADD `suplente` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `corridas` ADD `pontos_suplente` integer;
