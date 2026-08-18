CREATE TABLE `cc_kunjungan` (
	`tanggal` text PRIMARY KEY NOT NULL,
	`jumlah` integer DEFAULT 0 NOT NULL,
	`diperbarui_pada` integer DEFAULT (unixepoch()) NOT NULL
);
