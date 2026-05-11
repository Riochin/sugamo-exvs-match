CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`held_at` integer NOT NULL,
	`phase` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`pin_hash` text NOT NULL,
	`team` text NOT NULL,
	`title` text,
	`main_unit` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `players_name_unique` ON `players` (`name`);--> statement-breakpoint
CREATE TABLE `scores` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`player_id` text NOT NULL,
	`wins` integer DEFAULT 0 NOT NULL,
	`losses` integer DEFAULT 0 NOT NULL,
	`absent` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scores_event_player_uniq` ON `scores` (`event_id`,`player_id`);--> statement-breakpoint
CREATE TABLE `stars` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`from_player_id` text NOT NULL,
	`to_player_id` text NOT NULL,
	`count` integer NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
