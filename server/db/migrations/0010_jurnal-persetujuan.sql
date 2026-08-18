PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_cc_jurnal` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text(200) NOT NULL,
	`judul` text(300) NOT NULL,
	`judul_en` text(300),
	`ringkasan` text,
	`ringkasan_en` text,
	`isi` text,
	`isi_en` text,
	`tipe` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`editor_id` text,
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
	FOREIGN KEY (`editor_id`) REFERENCES `cc_user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `cc_user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`kegiatan_id`) REFERENCES `cc_kegiatan`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`cover_media_id`) REFERENCES `cc_media`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`dibuat_oleh`) REFERENCES `cc_user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "chk_jurnal_judul" CHECK(length(trim("__new_cc_jurnal"."judul")) > 0),
	CONSTRAINT "chk_jurnal_kontributor" CHECK(length(trim("__new_cc_jurnal"."kontributor")) > 0)
);
--> statement-breakpoint
INSERT INTO `__new_cc_jurnal`("id", "slug", "judul", "judul_en", "ringkasan", "ringkasan_en", "isi", "isi_en", "tipe", "status", "kontributor", "kontributor_peran", "user_id", "kegiatan_id", "cover_media_id", "catatan_revisi", "dibuat_oleh", "diterbitkan_pada", "created_at", "updated_at") SELECT "id", "slug", "judul", "judul_en", "ringkasan", "ringkasan_en", "isi", "isi_en", "tipe", "status", "kontributor", "kontributor_peran", "user_id", "kegiatan_id", "cover_media_id", "catatan_revisi", "dibuat_oleh", "diterbitkan_pada", "created_at", "updated_at" FROM `cc_jurnal`;--> statement-breakpoint
DROP TABLE `cc_jurnal`;--> statement-breakpoint
ALTER TABLE `__new_cc_jurnal` RENAME TO `cc_jurnal`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `cc_jurnal_slug_unique` ON `cc_jurnal` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_jurnal_status` ON `cc_jurnal` (`status`);--> statement-breakpoint
CREATE INDEX `idx_jurnal_tipe` ON `cc_jurnal` (`tipe`);--> statement-breakpoint
CREATE INDEX `idx_jurnal_kegiatan` ON `cc_jurnal` (`kegiatan_id`);--> statement-breakpoint
CREATE INDEX `idx_jurnal_terbit` ON `cc_jurnal` (`diterbitkan_pada`);--> statement-breakpoint
ALTER TABLE `cc_user` ADD `boleh_tulis_jurnal` integer DEFAULT false NOT NULL;--> statement-breakpoint
--- Nama status lama `terbit` diganti `published` bersama masuknya `approved`.
--- Tanpa baris ini, jurnal yang sudah terbit akan berstatus tak dikenal: halaman
--- publik menyaring `status = 'published'`, jadi keenam tulisan yang sudah tampil
--- akan hilang diam-diam tanpa satu pun galat.
UPDATE `cc_jurnal` SET `status` = 'published' WHERE `status` = 'terbit';
