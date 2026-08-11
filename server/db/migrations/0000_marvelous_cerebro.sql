CREATE TABLE `cc_user` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text(100) NOT NULL,
	`password` text(255) NOT NULL,
	`full_name` text(200) NOT NULL,
	`email` text(255),
	`role` text DEFAULT 'user' NOT NULL,
	`phone_number` text(20),
	`is_active` integer DEFAULT true NOT NULL,
	`avatar_media_id` text,
	`last_login` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cc_user_username_unique` ON `cc_user` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `cc_user_email_unique` ON `cc_user` (`email`);--> statement-breakpoint
CREATE INDEX `idx_user_role` ON `cc_user` (`role`);--> statement-breakpoint
CREATE INDEX `idx_user_email` ON `cc_user` (`email`);--> statement-breakpoint
CREATE TABLE `cc_media` (
	`id` text PRIMARY KEY NOT NULL,
	`original_name` text(500) NOT NULL,
	`file_name` text(500) NOT NULL,
	`mime_type` text(100) NOT NULL,
	`file_size` integer NOT NULL,
	`storage_key` text(500) NOT NULL,
	`public_url` text(1000) NOT NULL,
	`file_data` blob NOT NULL,
	`kind` text NOT NULL,
	`uploaded_by` text,
	`uploaded_at` integer NOT NULL,
	FOREIGN KEY (`uploaded_by`) REFERENCES `cc_user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "chk_media_size_positive" CHECK("cc_media"."file_size" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cc_media_storage_key_unique` ON `cc_media` (`storage_key`);--> statement-breakpoint
CREATE INDEX `idx_media_kind` ON `cc_media` (`kind`);--> statement-breakpoint
CREATE INDEX `idx_media_uploaded_by` ON `cc_media` (`uploaded_by`);--> statement-breakpoint
CREATE TABLE `cc_media_etc` (
	`media_id` text PRIMARY KEY NOT NULL,
	`mime_type` text(100) NOT NULL,
	`doc_type` text NOT NULL,
	`page_count` integer,
	`display_title` text(300),
	FOREIGN KEY (`media_id`) REFERENCES `cc_media`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `cc_media_gambar` (
	`media_id` text PRIMARY KEY NOT NULL,
	`mime_type` text(100) NOT NULL,
	`width` integer,
	`height` integer,
	`alt_text` text(500),
	`caption` text,
	`dominant_color` text(9),
	`thumbnail` blob,
	FOREIGN KEY (`media_id`) REFERENCES `cc_media`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "chk_media_gambar_mime" CHECK("cc_media_gambar"."mime_type" LIKE 'image/%')
);
--> statement-breakpoint
CREATE TABLE `cc_media_video` (
	`media_id` text PRIMARY KEY NOT NULL,
	`mime_type` text(100) NOT NULL,
	`duration_seconds` integer,
	`width` integer,
	`height` integer,
	`poster_media_id` text,
	FOREIGN KEY (`media_id`) REFERENCES `cc_media`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`poster_media_id`) REFERENCES `cc_media`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "chk_media_video_mime" CHECK("cc_media_video"."mime_type" LIKE 'video/%')
);
--> statement-breakpoint
CREATE TABLE `cc_kegiatan` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text(200) NOT NULL,
	`judul` text(300) NOT NULL,
	`judul_en` text(300),
	`deskripsi` text,
	`deskripsi_en` text,
	`lokasi` text(300),
	`tautan_daring` text(500),
	`tanggal_mulai` integer NOT NULL,
	`tanggal_selesai` integer,
	`tutup_pendaftaran` integer,
	`kuota` integer,
	`harga` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`cover_media_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "chk_kegiatan_harga" CHECK("cc_kegiatan"."harga" >= 0),
	CONSTRAINT "chk_kegiatan_kuota" CHECK("cc_kegiatan"."kuota" IS NULL OR "cc_kegiatan"."kuota" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cc_kegiatan_slug_unique` ON `cc_kegiatan` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_kegiatan_status` ON `cc_kegiatan` (`status`);--> statement-breakpoint
CREATE INDEX `idx_kegiatan_tanggal_mulai` ON `cc_kegiatan` (`tanggal_mulai`);--> statement-breakpoint
CREATE TABLE `cc_peserta` (
	`id` text PRIMARY KEY NOT NULL,
	`kegiatan_id` text NOT NULL,
	`user_id` text,
	`nama` text(200) NOT NULL,
	`email` text(255) NOT NULL,
	`no_hp` text(20),
	`institusi` text(200),
	`catatan` text,
	`status` text DEFAULT 'menunggu' NOT NULL,
	`terdaftar_pada` integer NOT NULL,
	`hadir_pada` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`kegiatan_id`) REFERENCES `cc_kegiatan`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `cc_user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "chk_peserta_email" CHECK("cc_peserta"."email" LIKE '%_@_%')
);
--> statement-breakpoint
CREATE INDEX `idx_peserta_kegiatan` ON `cc_peserta` (`kegiatan_id`);--> statement-breakpoint
CREATE INDEX `idx_peserta_status` ON `cc_peserta` (`status`);--> statement-breakpoint
CREATE INDEX `idx_peserta_user` ON `cc_peserta` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_peserta_kegiatan_email` ON `cc_peserta` (`kegiatan_id`,`email`);--> statement-breakpoint
CREATE TABLE `cc_transaksi_detail` (
	`id` text PRIMARY KEY NOT NULL,
	`transaksi_id` text NOT NULL,
	`kegiatan_id` text,
	`deskripsi` text(300) NOT NULL,
	`qty` integer DEFAULT 1 NOT NULL,
	`harga_satuan` integer DEFAULT 0 NOT NULL,
	`subtotal` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`transaksi_id`) REFERENCES `cc_transaksi_master`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`kegiatan_id`) REFERENCES `cc_kegiatan`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "chk_trxd_qty" CHECK("cc_transaksi_detail"."qty" > 0),
	CONSTRAINT "chk_trxd_harga" CHECK("cc_transaksi_detail"."harga_satuan" >= 0)
);
--> statement-breakpoint
CREATE INDEX `idx_trxd_transaksi` ON `cc_transaksi_detail` (`transaksi_id`);--> statement-breakpoint
CREATE INDEX `idx_trxd_kegiatan` ON `cc_transaksi_detail` (`kegiatan_id`);--> statement-breakpoint
CREATE TABLE `cc_transaksi_master` (
	`id` text PRIMARY KEY NOT NULL,
	`nomor` text(50) NOT NULL,
	`peserta_id` text,
	`user_id` text,
	`tanggal` integer NOT NULL,
	`subtotal` integer DEFAULT 0 NOT NULL,
	`diskon` integer DEFAULT 0 NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`metode_bayar` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`bukti_media_id` text,
	`dibayar_pada` integer,
	`catatan` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`peserta_id`) REFERENCES `cc_peserta`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `cc_user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "chk_trx_subtotal" CHECK("cc_transaksi_master"."subtotal" >= 0),
	CONSTRAINT "chk_trx_diskon" CHECK("cc_transaksi_master"."diskon" >= 0),
	CONSTRAINT "chk_trx_total" CHECK("cc_transaksi_master"."total" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cc_transaksi_master_nomor_unique` ON `cc_transaksi_master` (`nomor`);--> statement-breakpoint
CREATE INDEX `idx_trx_status` ON `cc_transaksi_master` (`status`);--> statement-breakpoint
CREATE INDEX `idx_trx_peserta` ON `cc_transaksi_master` (`peserta_id`);--> statement-breakpoint
CREATE INDEX `idx_trx_user` ON `cc_transaksi_master` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_trx_tanggal` ON `cc_transaksi_master` (`tanggal`);