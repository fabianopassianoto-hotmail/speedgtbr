ALTER TABLE `divisoes` ADD `status` text DEFAULT 'ativa' NOT NULL CHECK (`status` IN ('ativa', 'arquivada', 'cancelada'));--> statement-breakpoint
ALTER TABLE `divisoes` ADD `arquivada_em` text;--> statement-breakpoint
ALTER TABLE `divisoes` ADD `motivo_arquivamento` text;--> statement-breakpoint
UPDATE `temporadas`
SET `status`='ativa', `ativa`=1, `arquivada_em`=NULL, `motivo_arquivamento`=NULL
WHERE `id`='2026' AND `status`='cancelada';--> statement-breakpoint
INSERT INTO `divisoes` (`temporada_id`,`codigo`,`nome`,`cor`,`ordem`,`status`)
SELECT DISTINCT i.`temporada_id`, i.`serie`, 'Série ' || i.`serie`,
 CASE i.`serie` WHEN 'A' THEN '#F0B429' WHEN 'B' THEN '#5AA9E6' WHEN 'C' THEN '#E8604C' ELSE NULL END,
 CASE i.`serie` WHEN 'A' THEN 1 WHEN 'B' THEN 2 WHEN 'C' THEN 3 ELSE 99 END,
 'ativa'
FROM `inscricoes` i
WHERE NOT EXISTS (SELECT 1 FROM `divisoes` d WHERE d.`temporada_id`=i.`temporada_id` AND d.`codigo`=i.`serie`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_inscricoes` (
 `temporada_id` text NOT NULL, `piloto_id` text NOT NULL, `serie` text NOT NULL,
 `situacao` text, `saida_em` text, `motivo_saida` text, `previsao_volta` text,
 PRIMARY KEY(`temporada_id`, `piloto_id`),
 FOREIGN KEY (`temporada_id`) REFERENCES `temporadas`(`id`) ON DELETE restrict,
 FOREIGN KEY (`piloto_id`) REFERENCES `pilotos`(`id`) ON DELETE restrict,
 CONSTRAINT "ck_inscricoes_serie" CHECK(length(trim(`serie`)) > 0),
 CONSTRAINT "ck_inscricoes_situacao" CHECK(`situacao` IS NULL OR `situacao` IN ('ativo', 'suplente', 'inativo', 'saiu'))
);--> statement-breakpoint
INSERT INTO `__new_inscricoes` SELECT * FROM `inscricoes`;--> statement-breakpoint
DROP TABLE `inscricoes`;--> statement-breakpoint
ALTER TABLE `__new_inscricoes` RENAME TO `inscricoes`;--> statement-breakpoint
CREATE INDEX `idx_inscricoes_temporada_serie` ON `inscricoes` (`temporada_id`,`serie`);--> statement-breakpoint
PRAGMA foreign_keys=ON;
