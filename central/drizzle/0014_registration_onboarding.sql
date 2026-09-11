ALTER TABLE pilotos ADD COLUMN rua TEXT;
--> statement-breakpoint
ALTER TABLE pilotos ADD COLUMN numero TEXT;
--> statement-breakpoint
ALTER TABLE pilotos ADD COLUMN bairro TEXT;
--> statement-breakpoint
ALTER TABLE pilotos ADD COLUMN cep TEXT;
--> statement-breakpoint
ALTER TABLE pilotos ADD COLUMN complemento TEXT;
--> statement-breakpoint
ALTER TABLE pilotos ADD COLUMN classificacao_gt7 TEXT;
--> statement-breakpoint
ALTER TABLE fila ADD COLUMN rua TEXT;
--> statement-breakpoint
ALTER TABLE fila ADD COLUMN numero TEXT;
--> statement-breakpoint
ALTER TABLE fila ADD COLUMN bairro TEXT;
--> statement-breakpoint
ALTER TABLE fila ADD COLUMN cep TEXT;
--> statement-breakpoint
ALTER TABLE fila ADD COLUMN complemento TEXT;
--> statement-breakpoint
ALTER TABLE fila ADD COLUMN classificacao_gt7 TEXT;
--> statement-breakpoint
ALTER TABLE formularios_pendentes ADD COLUMN rua TEXT;
--> statement-breakpoint
ALTER TABLE formularios_pendentes ADD COLUMN numero TEXT;
--> statement-breakpoint
ALTER TABLE formularios_pendentes ADD COLUMN bairro TEXT;
--> statement-breakpoint
ALTER TABLE formularios_pendentes ADD COLUMN cep TEXT;
--> statement-breakpoint
ALTER TABLE formularios_pendentes ADD COLUMN complemento TEXT;
--> statement-breakpoint
ALTER TABLE formularios_pendentes ADD COLUMN classificacao_gt7 TEXT;
--> statement-breakpoint
ALTER TABLE formularios_pendentes ADD COLUMN submission_key TEXT;
--> statement-breakpoint
ALTER TABLE formularios_pendentes ADD COLUMN payload_hash TEXT;
--> statement-breakpoint
ALTER TABLE formularios_pendentes ADD COLUMN phone_normalized TEXT;
--> statement-breakpoint
ALTER TABLE formularios_pendentes ADD COLUMN email_status TEXT NOT NULL DEFAULT 'pending';
--> statement-breakpoint
ALTER TABLE formularios_pendentes ADD COLUMN email_attempt_at INTEGER;
--> statement-breakpoint
CREATE UNIQUE INDEX idx_form_submission_key ON formularios_pendentes(submission_key);
--> statement-breakpoint
CREATE UNIQUE INDEX idx_form_pending_phone ON formularios_pendentes(phone_normalized) WHERE status = 'pendente';
