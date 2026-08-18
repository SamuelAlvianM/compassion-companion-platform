CREATE TABLE `cc_log` (
	`id` text PRIMARY KEY NOT NULL,
	`segmen` text NOT NULL,
	`aksi` text(60) NOT NULL,
	`objek_id` text(40),
	`objek_label` text(300),
	`objek_slug` text(200),
	`pelaku_id` text(40),
	`pelaku_nama` text(200),
	`pelaku_role` text(20),
	`catatan` text,
	`created_at` integer NOT NULL,
	CONSTRAINT "chk_log_aksi" CHECK(length(trim("cc_log"."aksi")) > 0)
);
--> statement-breakpoint
CREATE INDEX `idx_log_segmen` ON `cc_log` (`segmen`);--> statement-breakpoint
CREATE INDEX `idx_log_waktu` ON `cc_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_log_objek` ON `cc_log` (`objek_id`);