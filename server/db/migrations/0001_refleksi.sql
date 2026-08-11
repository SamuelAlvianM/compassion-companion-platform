CREATE TABLE `cc_refleksi` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kegiatan_id` text,
	`isi` text NOT NULL,
	`media_id` text,
	`visibilitas` text DEFAULT 'publik' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `cc_user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`kegiatan_id`) REFERENCES `cc_kegiatan`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`media_id`) REFERENCES `cc_media`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "chk_refleksi_isi" CHECK(length(trim("cc_refleksi"."isi")) > 0)
);
--> statement-breakpoint
CREATE INDEX `idx_refleksi_user` ON `cc_refleksi` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_refleksi_kegiatan` ON `cc_refleksi` (`kegiatan_id`);--> statement-breakpoint
CREATE INDEX `idx_refleksi_dibuat` ON `cc_refleksi` (`created_at`);