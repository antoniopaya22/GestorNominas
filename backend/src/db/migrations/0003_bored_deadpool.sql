PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE cascade,
	`name` text NOT NULL,
	`color` text DEFAULT '#6366f1' NOT NULL
);--> statement-breakpoint
INSERT INTO `__new_tags` (`id`, `user_id`, `name`, `color`)
SELECT
	`id`,
	COALESCE(`user_id`, (SELECT `id` FROM `users` ORDER BY `id` LIMIT 1)),
	`name`,
	`color`
FROM `tags`;--> statement-breakpoint
DROP TABLE `tags`;--> statement-breakpoint
ALTER TABLE `__new_tags` RENAME TO `tags`;--> statement-breakpoint
CREATE TABLE `__new_alert_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE cascade,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);--> statement-breakpoint
INSERT INTO `__new_alert_rules` (`id`, `user_id`, `name`, `type`, `config`, `enabled`, `created_at`)
SELECT
	`id`,
	COALESCE(`user_id`, (SELECT `id` FROM `users` ORDER BY `id` LIMIT 1)),
	`name`,
	`type`,
	`config`,
	`enabled`,
	`created_at`
FROM `alert_rules`;--> statement-breakpoint
DROP TABLE `alert_rules`;--> statement-breakpoint
ALTER TABLE `__new_alert_rules` RENAME TO `alert_rules`;--> statement-breakpoint
CREATE TABLE `__new_profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE cascade,
	`name` text NOT NULL,
	`color` text DEFAULT '#6366f1' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);--> statement-breakpoint
INSERT INTO `__new_profiles` (`id`, `user_id`, `name`, `color`, `created_at`)
SELECT
	`id`,
	COALESCE(`user_id`, (SELECT `id` FROM `users` ORDER BY `id` LIMIT 1)),
	`name`,
	`color`,
	`created_at`
FROM `profiles`;--> statement-breakpoint
DROP TABLE `profiles`;--> statement-breakpoint
ALTER TABLE `__new_profiles` RENAME TO `profiles`;--> statement-breakpoint
ALTER TABLE `payslips` ADD `payslip_type` text DEFAULT 'ordinal' NOT NULL;--> statement-breakpoint
PRAGMA foreign_keys=ON;