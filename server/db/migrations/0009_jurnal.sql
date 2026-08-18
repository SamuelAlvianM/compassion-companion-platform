CREATE TABLE `cc_jurnal` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text(200) NOT NULL,
	`judul` text(300) NOT NULL,
	`judul_en` text(300),
	`ringkasan` text,
	`ringkasan_en` text,
	`isi` text,
	`isi_en` text,
	`tipe` text DEFAULT 'sharing-journey' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`kontributor` text(200) NOT NULL,
	`kontributor_peran` text(200),
	`user_id` text,
	`kegiatan_id` text,
	`cover_media_id` text,
	`catatan_revisi` text,
	`dibuat_oleh` text,
	`diterbitkan_pada` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `cc_user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`kegiatan_id`) REFERENCES `cc_kegiatan`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`cover_media_id`) REFERENCES `cc_media`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`dibuat_oleh`) REFERENCES `cc_user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "chk_jurnal_judul" CHECK(length(trim("cc_jurnal"."judul")) > 0),
	CONSTRAINT "chk_jurnal_kontributor" CHECK(length(trim("cc_jurnal"."kontributor")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cc_jurnal_slug_unique` ON `cc_jurnal` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_jurnal_status` ON `cc_jurnal` (`status`);--> statement-breakpoint
CREATE INDEX `idx_jurnal_tipe` ON `cc_jurnal` (`tipe`);--> statement-breakpoint
CREATE INDEX `idx_jurnal_kegiatan` ON `cc_jurnal` (`kegiatan_id`);--> statement-breakpoint
CREATE INDEX `idx_jurnal_terbit` ON `cc_jurnal` (`diterbitkan_pada`);