CREATE TABLE `caixa` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`temporada_id` text NOT NULL,
	`data` text NOT NULL,
	`piloto_id` text,
	`nome` text NOT NULL,
	`tipo` text NOT NULL,
	`valor` integer NOT NULL,
	`vai_para_medalha` integer GENERATED ALWAYS AS (max(0, valor - 2000)) STORED NOT NULL,
	`observacao` text,
	FOREIGN KEY (`temporada_id`) REFERENCES `temporadas`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`piloto_id`) REFERENCES `pilotos`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "ck_caixa_valor" CHECK("caixa"."valor" >= 0)
);
--> statement-breakpoint
CREATE INDEX `idx_caixa_temporada_piloto` ON `caixa` (`temporada_id`,`piloto_id`);--> statement-breakpoint
CREATE TABLE `calendario` (
	`temporada_id` text NOT NULL,
	`etapa` integer NOT NULL,
	`pista` text NOT NULL,
	`classe_ou_formato` text,
	`duracao` text,
	`data` text,
	`multiplicador` integer NOT NULL,
	`observacao` text,
	PRIMARY KEY(`temporada_id`, `etapa`),
	FOREIGN KEY (`temporada_id`) REFERENCES `temporadas`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "ck_calendario_etapa" CHECK("calendario"."etapa" > 0),
	CONSTRAINT "ck_calendario_multiplicador" CHECK("calendario"."multiplicador" > 0)
);
--> statement-breakpoint
CREATE TABLE `corridas` (
	`temporada_id` text NOT NULL,
	`etapa` integer NOT NULL,
	`piloto_id` text NOT NULL,
	`confirmou` integer,
	`compareceu` integer,
	`falta_justificada` integer,
	`posicao_final` integer,
	`volta_mais_rapida` integer DEFAULT false NOT NULL,
	`punicao` text,
	`abandono_motivo` text,
	`observacao` text,
	`pontos` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`temporada_id`, `etapa`, `piloto_id`),
	FOREIGN KEY (`piloto_id`) REFERENCES `pilotos`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`temporada_id`,`etapa`) REFERENCES `calendario`(`temporada_id`,`etapa`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "ck_corridas_posicao_final" CHECK("corridas"."posicao_final" IS NULL OR "corridas"."posicao_final" > 0),
	CONSTRAINT "ck_corridas_pontos" CHECK("corridas"."pontos" >= 0)
);
--> statement-breakpoint
CREATE INDEX `idx_corridas_temporada_etapa` ON `corridas` (`temporada_id`,`etapa`);--> statement-breakpoint
CREATE TABLE `fila` (
	`id` text PRIMARY KEY NOT NULL,
	`apelido` text NOT NULL,
	`nome_completo` text,
	`psn` text,
	`simgrid` text,
	`whatsapp` text,
	`cidade` text,
	`uf` text,
	`email` text,
	`corridas_4fun` integer,
	`conduta` text,
	`pronto_para_serie` integer,
	CONSTRAINT "ck_fila_id" CHECK("fila"."id" GLOB 'FIL[0-9][0-9][0-9]'),
	CONSTRAINT "ck_fila_apelido" CHECK(length(trim("fila"."apelido")) > 0),
	CONSTRAINT "ck_fila_corridas_4fun" CHECK("fila"."corridas_4fun" IS NULL OR "fila"."corridas_4fun" >= 0)
);
--> statement-breakpoint
CREATE INDEX `idx_fila_apelido` ON `fila` (`apelido`);--> statement-breakpoint
CREATE TABLE `inscricoes` (
	`temporada_id` text NOT NULL,
	`piloto_id` text NOT NULL,
	`serie` text NOT NULL,
	`situacao` text,
	PRIMARY KEY(`temporada_id`, `piloto_id`),
	FOREIGN KEY (`temporada_id`) REFERENCES `temporadas`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`piloto_id`) REFERENCES `pilotos`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "ck_inscricoes_serie" CHECK("inscricoes"."serie" IN ('A', 'B', 'C')),
	CONSTRAINT "ck_inscricoes_situacao" CHECK("inscricoes"."situacao" IS NULL OR "inscricoes"."situacao" IN ('ativo', 'suplente', 'saiu'))
);
--> statement-breakpoint
CREATE INDEX `idx_inscricoes_temporada_serie` ON `inscricoes` (`temporada_id`,`serie`);--> statement-breakpoint
CREATE TABLE `pilotos` (
	`id` text PRIMARY KEY NOT NULL,
	`apelido` text NOT NULL,
	`nome_completo` text,
	`psn` text,
	`simgrid` text,
	`simgrid_url` text,
	`whatsapp` text,
	`email` text,
	`cidade` text,
	`uf` text,
	`volante_ou_controle` text,
	`perfil_pilotagem` text,
	`disponibilidade` text,
	`carro_preferido` text,
	`pista_citada` text,
	`relacoes` text,
	`curiosidade` text,
	`observacoes_adm` text,
	`ativo` integer,
	CONSTRAINT "ck_pilotos_id" CHECK("pilotos"."id" GLOB 'SGT[0-9][0-9][0-9]'),
	CONSTRAINT "ck_pilotos_apelido" CHECK(length(trim("pilotos"."apelido")) > 0)
);
--> statement-breakpoint
CREATE TABLE `temporadas` (
	`id` text PRIMARY KEY NOT NULL,
	`nome` text NOT NULL,
	`ativa` integer NOT NULL,
	`total_etapas` integer NOT NULL,
	`pilotos_por_serie` integer NOT NULL,
	CONSTRAINT "ck_temporadas_total_etapas" CHECK("temporadas"."total_etapas" > 0),
	CONSTRAINT "ck_temporadas_pilotos_por_serie" CHECK("temporadas"."pilotos_por_serie" > 0)
);
