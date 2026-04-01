DROP INDEX `tags_name_unique`;--> statement-breakpoint
ALTER TABLE `tags` ADD `user_id` integer NOT NULL REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `alert_rules` ADD `user_id` integer NOT NULL REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `payslips` ADD `payslip_type` text DEFAULT 'ordinal' NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `user_id` integer NOT NULL REFERENCES users(id);