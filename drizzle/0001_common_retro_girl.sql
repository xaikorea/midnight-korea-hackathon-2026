CREATE TABLE IF NOT EXISTS `analytics_admin_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`occurred_at` text NOT NULL,
	`action` text NOT NULL,
	`month` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `visitor_events` (
	`id` text PRIMARY KEY NOT NULL,
	`occurred_at` text NOT NULL,
	`month` text NOT NULL,
	`day` text NOT NULL,
	`visitor_id` text NOT NULL,
	`user_id` text,
	`name` text,
	`ip` text,
	`country` text,
	`region` text,
	`city` text,
	`geo_source` text NOT NULL,
	`user_agent` text NOT NULL,
	`browser` text NOT NULL,
	`os` text NOT NULL,
	`device` text NOT NULL,
	`path` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `visitor_events_month_time` ON `visitor_events` (`month`,`occurred_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `visitor_events_user` ON `visitor_events` (`user_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `visitor_events_visitor` ON `visitor_events` (`visitor_id`,`occurred_at`);