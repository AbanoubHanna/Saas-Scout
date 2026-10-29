CREATE TABLE `trial_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`group_name` text NOT NULL,
	`church` text NOT NULL,
	`leader_name` text NOT NULL,
	`country` text NOT NULL,
	`phone` text NOT NULL,
	`email` text,
	`members` text,
	`notes` text,
	`consent` integer NOT NULL,
	`client_hash` text NOT NULL,
	`created_at` text NOT NULL
);
