ALTER TABLE `divisoes` ADD `limite_pilotos` integer;
--> statement-breakpoint
ALTER TABLE `divisoes` ADD `data_inicio` text;
--> statement-breakpoint
ALTER TABLE `divisoes` ADD `frequencia_dias` integer DEFAULT 7 NOT NULL;
