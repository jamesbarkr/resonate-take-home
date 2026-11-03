CREATE TABLE `appointment_types` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`duration_minutes` integer NOT NULL,
	`required_role` text NOT NULL,
	`description` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `appointment_types_slug_idx` ON `appointment_types` (`slug`);--> statement-breakpoint
CREATE TABLE `appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`appointment_type_id` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`status` text DEFAULT 'booked' NOT NULL,
	`notes` text,
	`idempotency_key` text,
	`conversation_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`appointment_type_id`) REFERENCES `appointment_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `appointments_idempotency_idx` ON `appointments` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `appointments_provider_start_idx` ON `appointments` (`provider_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `appointments_patient_start_idx` ON `appointments` (`patient_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `appointments_status_idx` ON `appointments` (`status`);--> statement-breakpoint
CREATE TABLE `availability_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`day_of_week` integer NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `availability_blocks_provider_day_idx` ON `availability_blocks` (`provider_id`,`day_of_week`);--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text,
	`channel` text DEFAULT 'web' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `conversations_patient_idx` ON `conversations` (`patient_id`);--> statement-breakpoint
CREATE TABLE `feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`message_id` text,
	`rating` integer NOT NULL,
	`comment` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `feedback_conversation_idx` ON `feedback` (`conversation_id`);--> statement-breakpoint
CREATE TABLE `households` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `insurance_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`accepted` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `insurance_plans_name_idx` ON `insurance_plans` (`name`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`metadata_json` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `messages_conversation_created_idx` ON `messages` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `patients` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text,
	`full_name` text NOT NULL,
	`phone` text NOT NULL,
	`date_of_birth` text NOT NULL,
	`insurance_name` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `patients_phone_idx` ON `patients` (`phone`);--> statement-breakpoint
CREATE INDEX `patients_household_idx` ON `patients` (`household_id`);--> statement-breakpoint
CREATE INDEX `patients_name_idx` ON `patients` (`full_name`);--> statement-breakpoint
CREATE TABLE `practice_config` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`address_line_1` text NOT NULL,
	`city` text NOT NULL,
	`state` text NOT NULL,
	`postal_code` text NOT NULL,
	`phone` text NOT NULL,
	`timezone` text NOT NULL,
	`hours_json` text NOT NULL,
	`insurance_note` text NOT NULL,
	`self_pay_note` text NOT NULL,
	`membership_note` text NOT NULL,
	`financing_note` text NOT NULL,
	`emergency_note` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `providers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `slot_holds` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`conversation_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `slot_holds_provider_start_idx` ON `slot_holds` (`provider_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `slot_holds_expiry_idx` ON `slot_holds` (`expires_at`);--> statement-breakpoint
CREATE TABLE `staff_alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text,
	`patient_id` text,
	`kind` text NOT NULL,
	`urgency` text DEFAULT 'medium' NOT NULL,
	`summary` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text NOT NULL,
	`acknowledged_at` text,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `staff_alerts_status_idx` ON `staff_alerts` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `tool_calls` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`tool_name` text NOT NULL,
	`arguments_json` text NOT NULL,
	`result_json` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`error` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tool_calls_conversation_idx` ON `tool_calls` (`conversation_id`,`created_at`);