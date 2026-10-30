CREATE TABLE `scout_backups` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`storage_key` text NOT NULL,
	`hash` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`files` integer NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `scout_groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scout_backups_storage_key_unique` ON `scout_backups` (`storage_key`);--> statement-breakpoint
CREATE TABLE `scout_commands` (
	`key` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`command_id` text NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`payload` text NOT NULL,
	`fingerprint` text NOT NULL,
	`created_at` text NOT NULL,
	`revision` integer NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `scout_groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `scout_commands_group_revision` ON `scout_commands` (`group_id`,`revision`);--> statement-breakpoint
CREATE TABLE `scout_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`role` text NOT NULL,
	`unit` text,
	`member_id` text,
	`email` text,
	`created_by` text NOT NULL,
	`expires_at` text NOT NULL,
	`claimed_by` text,
	`revoked_at` text,
	FOREIGN KEY (`group_id`) REFERENCES `scout_groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scout_invites_token_hash_unique` ON `scout_invites` (`token_hash`);--> statement-breakpoint
CREATE TABLE `scout_records` (
	`key` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`collection` text NOT NULL,
	`entity_id` text NOT NULL,
	`data` text NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `scout_groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `scout_records_group_collection` ON `scout_records` (`group_id`,`collection`);--> statement-breakpoint
CREATE TABLE `scout_subscriptions` (
	`group_id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`starts_on` text NOT NULL,
	`ends_on` text NOT NULL,
	`billing_months` integer NOT NULL,
	`amount` integer NOT NULL,
	`addons` text NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `scout_groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `scout_support_log` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`grant_id` text NOT NULL,
	`operator_id` text NOT NULL,
	`scope` text NOT NULL,
	`at` text NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `scout_groups`(`id`) ON UPDATE no action ON DELETE no action
);
