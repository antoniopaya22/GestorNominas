CREATE INDEX "payslip_concepts_payslip_idx" ON "payslip_concepts" USING btree ("payslip_id");--> statement-breakpoint
CREATE INDEX "payslips_profile_period_idx" ON "payslips" USING btree ("profile_id","period_year","period_month");--> statement-breakpoint
CREATE INDEX "transactions_user_date_idx" ON "transactions" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "transactions_account_idx" ON "transactions" USING btree ("account_id");--> statement-breakpoint
-- Antes de las dos claves únicas: por si ya existen duplicados reales
-- (un doble clic en "asignar etiqueta", o una carrera entre dos
-- evaluaciones simultáneas de syncRecurringTransactions), se borran primero
-- quedándonos con la fila más antigua — si no, CREATE UNIQUE INDEX fallaría
-- contra datos ya existentes.
DELETE FROM "payslip_tags" a USING "payslip_tags" b
  WHERE a.id > b.id AND a.payslip_id = b.payslip_id AND a.tag_id = b.tag_id;--> statement-breakpoint
CREATE UNIQUE INDEX "payslip_tags_payslip_tag_idx" ON "payslip_tags" USING btree ("payslip_id","tag_id");--> statement-breakpoint
-- Al deduplicar aquí no basta con quedarse con la fila más antigua: si una
-- de las duplicadas ya está conciliada (cleared = true) por el usuario, esa
-- es la que se conserva pase lo que pase, para no perder su conciliación.
DELETE FROM "transactions" a USING "transactions" b
  WHERE a.id <> b.id
    AND a.recurring_transaction_id IS NOT NULL
    AND a.recurring_transaction_id = b.recurring_transaction_id
    AND a.scheduled_for = b.scheduled_for
    AND (
      (b.cleared = true AND a.cleared = false)
      OR (b.cleared = a.cleared AND b.id < a.id)
    );--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_recurring_occurrence_idx" ON "transactions" USING btree ("recurring_transaction_id","scheduled_for");
