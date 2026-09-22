CREATE TABLE IF NOT EXISTS `admin_credentials` (
	`username` text PRIMARY KEY NOT NULL,
	`password_hash` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`changed_at` text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `admin_password_rate` (
	`username` text PRIMARY KEY NOT NULL,
	`window` integer NOT NULL,
	`n` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `admin_security_audit` (
	`revision` integer PRIMARY KEY NOT NULL,
	`occurred_at` text NOT NULL,
	`action` text NOT NULL
);
