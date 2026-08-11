ALTER TABLE `cc_kegiatan` ADD `jam_mulai` text(5);--> statement-breakpoint
ALTER TABLE `cc_kegiatan` ADD `jam_selesai` text(5);--> statement-breakpoint
-- Kolom `status` berhenti dipakai sebagai keadaan redaksional: fase kini murni
-- turunan tanggal (lihat server/utils/kegiatan.ts) dan formulir admin tidak lagi
-- punya pilihan status. Baris `draft` yang tertinggal tidak akan pernah tampil di
-- halaman publik dan tidak punya lagi antarmuka untuk diterbitkan, jadi semuanya
-- diterbitkan di sini. Kolomnya sendiri dibiarkan ada — `batal` masih dipakai
-- faseKegiatan() dan menghapus kolom menuntut menulis ulang seluruh tabel.
UPDATE `cc_kegiatan` SET `status` = 'terbit' WHERE `status` = 'draft';
