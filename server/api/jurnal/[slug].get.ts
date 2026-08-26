// server/api/jurnal/[slug].get.ts
// Satu jurnal untuk halaman baca publik.
//
// Dicari lewat slug, bukan id: itu yang ada di alamat, dan itu yang dibagikan
// orang. Yang belum terbit dijawab 404 — bukan 403, karena bagi pengunjung yang
// tidak berkepentingan, tulisan yang belum terbit memang tidak ada.

import { and, eq } from 'drizzle-orm'
import { db } from '../../db'
import { ccJurnal, ccKegiatan, ccMedia, ccUser } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Alamat jurnal tidak lengkap' })

  const baris = db
    .select()
    .from(ccJurnal)
    .where(and(eq(ccJurnal.slug, slug), eq(ccJurnal.status, 'published')))
    .get()

  if (!baris) throw createError({ statusCode: 404, statusMessage: 'Jurnal tidak ditemukan' })

  // Ketiga tambahan ini diambil terpisah dengan alasan yang sama seperti di
  // endpoint admin: semuanya opsional, dan join akan menghilangkan barisnya kalau
  // salah satu tujuannya sudah tidak ada.
  const cover = baris.coverMediaId
    ? db.select({ url: ccMedia.publicUrl }).from(ccMedia).where(eq(ccMedia.id, baris.coverMediaId)).get()
    : null

  const kegiatan = baris.kegiatanId
    ? db
        .select({ slug: ccKegiatan.slug, judul: ccKegiatan.judul, judulEn: ccKegiatan.judulEn })
        .from(ccKegiatan)
        .where(eq(ccKegiatan.id, baris.kegiatanId))
        .get()
    : null

  // Username dipakai menautkan ke profil publik penulis, kalau ia memang punya akun.
  const penulis = baris.userId
    ? db.select({ id: ccUser.id, nama: ccUser.fullName }).from(ccUser).where(eq(ccUser.id, baris.userId)).get()
    : null

  // Kolomnya disebut satu per satu, bukan `...baris`. Baris utuh membawa
  // `catatanRevisi`, `dibuatOleh`, dan `status` — catatan internal redaksi yang
  // tidak ada urusannya dengan pembaca, dan yang pertama bahkan berisi penilaian
  // admin atas tulisan orang.
  return {
    data: {
      id: baris.id,
      slug: baris.slug,
      judul: baris.judul,
      judulEn: baris.judulEn,
      ringkasan: baris.ringkasan,
      ringkasanEn: baris.ringkasanEn,
      isi: baris.isi,
      isiEn: baris.isiEn,
      tipe: baris.tipe,

      /**
       * Nama akun yang HIDUP menang atas teks yang tersimpan di barisnya.
       *
       * `cc_jurnal.kontributor` sengaja menyimpan nama sebagai teks, supaya tulisan
       * tidak kehilangan penulis saat akunnya dihapus (lihat komentarnya di
       * server/db/schema/jurnal.ts). Tapi teks itu ditulis sekali saat jurnalnya
       * dibuat dan tidak pernah ikut berubah — jadi member yang mengganti namanya
       * di halaman akun tetap tampil dengan nama lamanya di halaman publik, tanpa
       * ada satu pun tempat yang bisa ia pakai membetulkannya.
       *
       * Urutannya menjawab keduanya sekaligus: selama akunnya ada, namanya yang
       * dipakai; begitu akunnya hilang, teks tersimpan yang bertahan.
       */
      kontributor: penulis?.nama ?? baris.kontributor,
      kontributorPeran: baris.kontributorPeran,
      tanggal: baris.diterbitkanPada ?? baris.createdAt,
      coverUrl: cover?.url ?? null,
      kegiatan: kegiatan ?? null,
      penulis: penulis ?? null,
    },
  }
})
