ALTER TABLE "alert_history" ADD COLUMN "user_id" integer;--> statement-breakpoint
-- Filas previas: se asignan al dueño de su regla; sin regla no hay forma de saber de quién son.
UPDATE "alert_history" SET "user_id" = "alert_rules"."user_id" FROM "alert_rules" WHERE "alert_history"."rule_id" = "alert_rules"."id";--> statement-breakpoint
DELETE FROM "alert_history" WHERE "user_id" IS NULL;--> statement-breakpoint
ALTER TABLE "alert_history" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "alert_history" ADD CONSTRAINT "alert_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
