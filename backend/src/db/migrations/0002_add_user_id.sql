-- Add user_id to profiles for multi-tenancy
ALTER TABLE `profiles` ADD COLUMN `user_id` integer REFERENCES `users`(`id`) ON DELETE cascade;
--> statement-breakpoint
-- Backfill: assign existing profiles to user id 1 (first registered user)
UPDATE `profiles` SET `user_id` = (SELECT `id` FROM `users` ORDER BY `id` LIMIT 1) WHERE `user_id` IS NULL;
--> statement-breakpoint
-- Add user_id to tags for multi-tenancy
ALTER TABLE `tags` ADD COLUMN `user_id` integer REFERENCES `users`(`id`) ON DELETE cascade;
--> statement-breakpoint
-- Backfill tags
UPDATE `tags` SET `user_id` = (SELECT `id` FROM `users` ORDER BY `id` LIMIT 1) WHERE `user_id` IS NULL;
--> statement-breakpoint
-- Drop old unique index on tags.name (now scoped per user)
DROP INDEX IF EXISTS `tags_name_unique`;
--> statement-breakpoint
-- Add user_id to alert_rules for multi-tenancy
ALTER TABLE `alert_rules` ADD COLUMN `user_id` integer REFERENCES `users`(`id`) ON DELETE cascade;
--> statement-breakpoint
-- Backfill alert_rules
UPDATE `alert_rules` SET `user_id` = (SELECT `id` FROM `users` ORDER BY `id` LIMIT 1) WHERE `user_id` IS NULL;
