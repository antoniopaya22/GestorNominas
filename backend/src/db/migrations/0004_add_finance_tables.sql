CREATE TABLE `accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
	`name` text NOT NULL,
	`type` text NOT NULL DEFAULT 'bank',
	`currency` text NOT NULL DEFAULT 'EUR',
	`initial_balance` real NOT NULL DEFAULT 0,
	`color` text NOT NULL DEFAULT '#6366f1',
	`icon` text,
	`archived` integer NOT NULL DEFAULT 0,
	`created_at` text NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `category_groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
	`name` text NOT NULL,
	`icon` text,
	`sort_order` integer NOT NULL DEFAULT 0,
	`created_at` text NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` integer NOT NULL REFERENCES `category_groups`(`id`) ON DELETE CASCADE,
	`name` text NOT NULL,
	`sort_order` integer NOT NULL DEFAULT 0,
	`created_at` text NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
	`account_id` integer NOT NULL REFERENCES `accounts`(`id`) ON DELETE CASCADE,
	`category_id` integer REFERENCES `categories`(`id`) ON DELETE SET NULL,
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`date` text NOT NULL,
	`payee` text,
	`memo` text,
	`cleared` integer NOT NULL DEFAULT 0,
	`transfer_id` integer,
	`flag` text,
	`imported_from` text,
	`created_at` text NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX `idx_transactions_user_date` ON `transactions` (`user_id`, `date`);
--> statement-breakpoint
CREATE INDEX `idx_transactions_account` ON `transactions` (`account_id`);
--> statement-breakpoint
CREATE INDEX `idx_transactions_category` ON `transactions` (`category_id`);
--> statement-breakpoint
CREATE INDEX `idx_accounts_user` ON `accounts` (`user_id`);
