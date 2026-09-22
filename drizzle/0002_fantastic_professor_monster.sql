CREATE TABLE IF NOT EXISTS `visitor_profiles` (
	`visitor_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`company` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
