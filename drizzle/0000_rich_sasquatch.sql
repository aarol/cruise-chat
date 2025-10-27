CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`user_id` text NOT NULL,
	`message_type` text DEFAULT 'text',
	`created_at` integer DEFAULT (strftime('%s', 'now'))
);
