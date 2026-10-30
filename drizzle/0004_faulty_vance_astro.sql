CREATE TABLE `scout_test_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`username` text NOT NULL,
	`login_key_hash` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`group_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`failed_attempts` integer DEFAULT 0 NOT NULL,
	`locked_until` text,
	FOREIGN KEY (`group_id`) REFERENCES `scout_groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scout_test_accounts_username_unique` ON `scout_test_accounts` (`username`);--> statement-breakpoint
CREATE TABLE `scout_test_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`account_id`) REFERENCES `scout_test_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
