CREATE TABLE `cc_sesi` (
	`id` text PRIMARY KEY NOT NULL,
	`kegiatan_id` text NOT NULL,
	`judul` text(300) NOT NULL,
	`judul_en` text(300),
	`tanggal` integer,
	`urutan` integer DEFAULT 0 NOT NULL,
	`tampil` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`kegiatan_id`) REFERENCES `cc_kegiatan`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sesi_kegiatan_urutan` ON `cc_sesi` (`kegiatan_id`,`urutan`);--> statement-breakpoint
CREATE TABLE `cc_sesi_item` (
	`id` text PRIMARY KEY NOT NULL,
	`sesi_id` text NOT NULL,
	`bagian` text NOT NULL,
	`jenis` text NOT NULL,
	`judul` text(300) NOT NULL,
	`judul_en` text(300),
	`media_id` text,
	`url` text(1000),
	`terkunci` integer DEFAULT false NOT NULL,
	`urutan` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`sesi_id`) REFERENCES `cc_sesi`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`media_id`) REFERENCES `cc_media`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "chk_sesi_item_sumber" CHECK("cc_sesi_item"."media_id" IS NOT NULL OR "cc_sesi_item"."url" IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX `idx_sesi_item_sesi` ON `cc_sesi_item` (`sesi_id`,`bagian`,`urutan`);