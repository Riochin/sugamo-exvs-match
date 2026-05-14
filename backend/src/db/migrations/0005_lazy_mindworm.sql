ALTER TABLE `events` ADD `name` text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE `events` ADD `has_promotion_relegation` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `venue` text;--> statement-breakpoint
ALTER TABLE `events` ADD `description` text;