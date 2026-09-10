ALTER TABLE `temporadas` ADD `status` text DEFAULT 'ativa' NOT NULL CHECK (`status` IN ('ativa', 'arquivada', 'cancelada'));--> statement-breakpoint
ALTER TABLE `temporadas` ADD `arquivada_em` text;--> statement-breakpoint
ALTER TABLE `temporadas` ADD `motivo_arquivamento` text;
