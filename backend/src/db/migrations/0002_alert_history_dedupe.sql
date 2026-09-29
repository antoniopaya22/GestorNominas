ALTER TABLE "alert_history" ADD COLUMN "payslip_id" integer;--> statement-breakpoint
ALTER TABLE "alert_history" ADD COLUMN "dedupe_key" text;--> statement-breakpoint
ALTER TABLE "alert_history" ADD CONSTRAINT "alert_history_payslip_id_payslips_id_fk" FOREIGN KEY ("payslip_id") REFERENCES "public"."payslips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "alert_history_rule_dedupe_idx" ON "alert_history" USING btree ("rule_id","dedupe_key");