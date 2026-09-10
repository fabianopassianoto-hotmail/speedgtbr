ALTER TABLE `temporadas` ADD `tipo_evento` text DEFAULT 'campeonato' NOT NULL CHECK (`tipo_evento` IN ('campeonato', '4fun'));--> statement-breakpoint
ALTER TABLE `temporadas` ADD `gera_classificacao` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `temporadas` ADD `regra_carro` text CHECK (`regra_carro` IS NULL OR `regra_carro` IN ('regulamento', 'piloto', 'misto'));--> statement-breakpoint
ALTER TABLE `temporadas` ADD `carro_padrao` text;--> statement-breakpoint
ALTER TABLE `temporadas` ADD `fabricante_padrao` text;--> statement-breakpoint
CREATE TABLE `divisoes` (
 `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
 `temporada_id` text NOT NULL,
 `codigo` text NOT NULL,
 `nome` text NOT NULL,
 `cor` text,
 `ordem` integer NOT NULL,
 `regra_carro` text,
 `carro_padrao` text,
 `fabricante_padrao` text,
 FOREIGN KEY (`temporada_id`) REFERENCES `temporadas`(`id`) ON DELETE restrict,
 CONSTRAINT "ck_divisoes_codigo" CHECK(length(trim(`codigo`)) > 0),
 CONSTRAINT "ck_divisoes_nome" CHECK(length(trim(`nome`)) > 0),
 CONSTRAINT "ck_divisoes_ordem" CHECK(`ordem` > 0),
 CONSTRAINT "ck_divisoes_regra_carro" CHECK(`regra_carro` IS NULL OR `regra_carro` IN ('regulamento', 'piloto', 'misto'))
);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_divisoes_temporada_codigo` ON `divisoes` (`temporada_id`,`codigo`);--> statement-breakpoint
CREATE INDEX `idx_divisoes_temporada_ordem` ON `divisoes` (`temporada_id`,`ordem`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_inscricoes` (
 `temporada_id` text NOT NULL, `piloto_id` text NOT NULL, `serie` text NOT NULL,
 `situacao` text, `saida_em` text, `motivo_saida` text, `previsao_volta` text,
 PRIMARY KEY(`temporada_id`, `piloto_id`),
 FOREIGN KEY (`temporada_id`) REFERENCES `temporadas`(`id`) ON DELETE restrict,
 FOREIGN KEY (`piloto_id`) REFERENCES `pilotos`(`id`) ON DELETE restrict,
 CONSTRAINT "ck_inscricoes_serie" CHECK(length(trim(`serie`)) > 0),
 CONSTRAINT "ck_inscricoes_situacao" CHECK(`situacao` IS NULL OR `situacao` IN ('ativo', 'suplente', 'saiu'))
);--> statement-breakpoint
INSERT INTO `__new_inscricoes` SELECT * FROM `inscricoes`;--> statement-breakpoint
DROP TABLE `inscricoes`;--> statement-breakpoint
ALTER TABLE `__new_inscricoes` RENAME TO `inscricoes`;--> statement-breakpoint
CREATE INDEX `idx_inscricoes_temporada_serie` ON `inscricoes` (`temporada_id`,`serie`);--> statement-breakpoint
CREATE TABLE `__new_usuarios_acessos` (
 `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `account_user_id` text,
 `email` text NOT NULL, `nome` text, `papel` text NOT NULL, `serie` text,
 `ativo` integer DEFAULT true NOT NULL,
 CONSTRAINT "ck_usuarios_acessos_papel" CHECK(`papel` IN ('administrador', 'coordenador'))
);--> statement-breakpoint
INSERT INTO `__new_usuarios_acessos` SELECT * FROM `usuarios_acessos`;--> statement-breakpoint
DROP TABLE `usuarios_acessos`;--> statement-breakpoint
ALTER TABLE `__new_usuarios_acessos` RENAME TO `usuarios_acessos`;--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_usuarios_acessos_account_user_id` ON `usuarios_acessos` (`account_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_usuarios_acessos_email` ON `usuarios_acessos` (`email`);--> statement-breakpoint
CREATE INDEX `idx_usuarios_acessos_papel_serie` ON `usuarios_acessos` (`papel`,`serie`);--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `calendario` ADD `regra_carro` text CHECK (`regra_carro` IS NULL OR `regra_carro` IN ('regulamento', 'piloto', 'misto'));--> statement-breakpoint
ALTER TABLE `calendario` ADD `carro_padrao` text;--> statement-breakpoint
ALTER TABLE `calendario` ADD `fabricante_padrao` text;--> statement-breakpoint
ALTER TABLE `corridas` ADD `carro` text;--> statement-breakpoint
ALTER TABLE `corridas` ADD `fabricante` text;--> statement-breakpoint
ALTER TABLE `corridas` ADD `origem_carro` text CHECK (`origem_carro` IS NULL OR `origem_carro` IN ('regulamento', 'piloto'));
