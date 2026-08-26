// server/api/jurnal/index.get.ts
// Daftar jurnal untuk halaman publik /id/jurnal dan /en/jurnal.
//
// Hanya yang berstatus `terbit`. Draft, yang sedang direview, dan yang diminta
// revisi tidak pernah bocor ke sini — penyaringnya di WHERE, bukan di klien.

import { desc, eq } from 'drizzle-orm'
import { db } from '../../db'
import { ccJurnal, ccKegiatan, ccMedia, ccUser } from '../../db/schema'
import { keTeks } from '../../utils/html'

export default defineEventHandler(async () => {
  const rows = await db
    .select({
      id: ccJurnal.id,
      slug: ccJurnal.slug,
      judul: ccJurnal.judul,
      judulEn: ccJurnal.judulEn,
      ringkasan: ccJurnal.ringkasan,
      ringkasanEn: ccJurnal.ringkasanEn,
      isi: ccJurnal.isi,
      tipe: ccJurnal.tipe,
      kontributor: ccJurnal.kontributor,
      // Nama akun yang hidup, kalau penulisnya memang punya akun. Dipakai
      // menggantikan `kontributor` di bawah — lihat alasannya di sana.
      namaAkun: ccUser.fullName,
      kontributorPeran: ccJurnal.kontributorPeran,
      kegiatanId: ccJurnal.kegiatanId,
      kegiatanJudul: ccKegiatan.judul,
      coverUrl: ccMedia.publicUrl,
      diterbitkanPada: ccJurnal.diterbitkanPada,
      createdAt: ccJurnal.createdAt,
    })
    .from(ccJurnal)
    .leftJoin(ccKegiatan, eq(ccJurnal.kegiatanId, ccKegiatan.id))
    .leftJoin(ccMedia, eq(ccJurnal.coverMediaId, ccMedia.id))
    // `leftJoin`, bukan `innerJoin`: sebagian penulis memang tidak punya akun —
    // pembicara tamu, penulis sekali jalan — dan innerJoin akan membuang tulisan
    // mereka dari daftar publik sama sekali.
    .leftJoin(ccUser, eq(ccJurnal.userId, ccUser.id))
    .where(eq(ccJurnal.status, 'published'))
    .orderBy(desc(ccJurnal.diterbitkanPada))

  const data = rows.map(({ isi, namaAkun, ...row }) => ({
    ...row,

    /**
     * Nama akun yang HIDUP menang atas teks yang tersimpan di barisnya.
     *
     * `cc_jurnal.kontributor` sengaja menyimpan nama sebagai teks supaya tulisan
     * tidak kehilangan penulis saat akunnya dihapus. Tapi teks itu ditulis sekali
     * saat jurnalnya dibuat dan tidak pernah ikut berubah — jadi member yang
     * mengganti namanya tetap tampil dengan nama lamanya di kartu daftar publik,
     * tanpa ada satu pun tempat yang bisa ia pakai membetulkannya.
     *
     * Urutannya menjawab keduanya: selama akunnya ada, namanya yang dipakai;
     * begitu akunnya hilang, teks tersimpan yang bertahan.
     */
    kontributor: namaAkun ?? row.kontributor,
    // Kartu daftar memakai ringkasan bila ada; kalau penulisnya tidak mengisi,
    // dipotong dari isi tulisannya. Pemotongan dilakukan di server supaya HTML-nya
    // tidak perlu dikirim utuh hanya untuk diambil 180 karakter pertamanya —
    // sebuah artikel bisa puluhan kilobyte.
    ringkasan: row.ringkasan ?? potong(keTeks(isi), 180),
    ringkasanEn: row.ringkasanEn,
    tanggal: row.diterbitkanPada ?? row.createdAt,
  }))

  return {
    data,
    meta: {
      total: data.length,
      // Yang belum berkategori dilewati, bukan dijadikan ember 'null': kategori
      // baru dipasang admin, dan tulisan tanpa kategori tidak pernah bisa terbit —
      // jadi di daftar publik ia tidak akan pernah muncul.
      perTipe: data.reduce<Record<string, number>>((acc, j) => {
        if (j.tipe) acc[j.tipe] = (acc[j.tipe] ?? 0) + 1
        return acc
      }, {}),
    },
  }
})

/** Potong di batas kata terdekat, bukan di tengah kata. */
const potong = (teks: string, batas: number) => {
  if (teks.length <= batas) return teks
  const potongan = teks.slice(0, batas)
  const spasi = potongan.lastIndexOf(' ')
  return `${(spasi > batas * 0.6 ? potongan.slice(0, spasi) : potongan).trimEnd()}…`
}
