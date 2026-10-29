CREATE TABLE `group_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`user_id` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `scout_groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `platform_operators` (
	`user_id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scout_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`trial_request_id` text,
	`state` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scout_groups_trial_request_id_unique` ON `scout_groups` (`trial_request_id`);