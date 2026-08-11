-- Kosakata status peserta diganti agar sejalan dengan alur kerja admin yang nyata:
--
--   menunggu      -> baru        (pendaftaran masuk, belum disentuh)
--   terkonfirmasi -> konfirmasi  (sudah dipastikan ikut)
--   hadir         -> konfirmasi  (kehadiran dicatat lewat hadir_pada, bukan status)
--   batal         -> batal       (tetap)
--
-- `proses` adalah status baru dan tidak punya padanan lama, jadi tidak ada baris
-- lama yang dipetakan ke sana.
--
-- `hadir` dilebur, bukan dipertahankan: kolom `hadir_pada` sudah mencatat kehadiran
-- dengan lebih tepat (kapan, bukan sekadar ya/tidak), dan menyimpan keduanya berarti
-- dua sumber kebenaran yang bisa saling bertentangan.
--
-- CATATAN: baris INSERT di bawah sengaja menulis NULL untuk `status_sebelum_batal`,
-- bukan menyalinnya dari tabel lama seperti yang dihasilkan drizzle-kit. Kolom itu
-- baru ada di tabel baru; menyalin dari tabel lama membuat seluruh migrasi gagal
-- dengan "no such column".

PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_cc_peserta` (
	`id` text PRIMARY KEY NOT NULL,
	`kegiatan_id` text NOT NULL,
	`user_id` text,
	`nama` text(200) NOT NULL,
	`email` text(255) NOT NULL,
	`no_hp` text(20),
	`institusi` text(200),
	`catatan` text,
	`status` text DEFAULT 'baru' NOT NULL,
	`status_sebelum_batal` text,
	`terdaftar_pada` integer NOT NULL,
	`hadir_pada` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`kegiatan_id`) REFERENCES `cc_kegiatan`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `cc_user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "chk_peserta_email" CHECK("__new_cc_peserta"."email" LIKE '%_@_%')
);
--> statement-breakpoint
INSERT INTO `__new_cc_peserta`("id", "kegiatan_id", "user_id", "nama", "email", "no_hp", "institusi", "catatan", "status", "status_sebelum_batal", "terdaftar_pada", "hadir_pada", "created_at", "updated_at") SELECT "id", "kegiatan_id", "user_id", "nama", "email", "no_hp", "institusi", "catatan", "status", NULL, "terdaftar_pada", "hadir_pada", "created_at", "updated_at" FROM `cc_peserta`;--> statement-breakpoint
DROP TABLE `cc_peserta`;--> statement-breakpoint
ALTER TABLE `__new_cc_peserta` RENAME TO `cc_peserta`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
UPDATE `cc_peserta` SET `status` = 'baru' WHERE `status` = 'menunggu';--> statement-breakpoint
UPDATE `cc_peserta` SET `status` = 'konfirmasi' WHERE `status` IN ('terkonfirmasi', 'hadir');--> statement-breakpoint
CREATE INDEX `idx_peserta_kegiatan` ON `cc_peserta` (`kegiatan_id`);--> statement-breakpoint
CREATE INDEX `idx_peserta_status` ON `cc_peserta` (`status`);--> statement-breakpoint
CREATE INDEX `idx_peserta_user` ON `cc_peserta` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_peserta_kegiatan_email` ON `cc_peserta` (`kegiatan_id`,`email`);
