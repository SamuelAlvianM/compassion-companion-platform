// server/api/events/index.get.ts
// Daftar kegiatan publik untuk halaman /id/events dan /en/events.
//
// Query:
//   fase   — mendatang | berlangsung | selesai   (boleh diulang: ?fase=a&fase=b)
//   dari   — YYYY-MM-DD, hanya kegiatan yang berakhir pada/sesudah tanggal ini
//   sampai — YYYY-MM-DD, hanya kegiatan yang mulai pada/sebelum tanggal ini
//
// Penyaringan fase dikerjakan di JS, bukan SQL, karena fase adalah turunan tanggal
// (lihat server/utils/kegiatan.ts) dan bukan kolom yang bisa di-WHERE.

import { and, desc, eq, gte, inArray, lte, ne, sql, type SQL } from 'drizzle-orm'
import { db } from '../../db'
import { ccKegiatan, ccMedia, ccPeserta } from '../../db/schema'
import { faseKegiatan, pendaftaranTerbuka, FASE, type Fase } from '../../utils/kegiatan'
import { userSaatIni } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)

  const faseDiminta = (Array.isArray(q.fase) ? q.fase : q.fase ? [q.fase] : [])
    .map(String)
    .filter((f): f is Fase => FASE.includes(f as Fase))

  const filters: SQL[] = [
    // Draft tidak pernah tampil di halaman publik.
    ne(ccKegiatan.status, 'draft'),
  ]

  const parseTanggal = (nilai: unknown) => {
    if (typeof nilai !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(nilai)) return null
    const tanggal = new Date(`${nilai}T00:00:00+07:00`)
    return Number.isNaN(tanggal.getTime()) ? null : tanggal
  }

  const dari = parseTanggal(q.dari)
  const sampai = parseTanggal(q.sampai)

  // Rentang disaring berdasarkan tanggal MULAI kegiatan — paling mudah ditebak
  // pengguna: "tampilkan event yang dimulai antara A dan B".
  if (dari) filters.push(gte(ccKegiatan.tanggalMulai, dari))
  if (sampai) filters.push(lte(ccKegiatan.tanggalMulai, new Date(sampai.getTime() + 86_400_000 - 1)))

  const rows = await db
    .select()
    .from(ccKegiatan)
    .where(and(...filters))
    // Tanggal terbaru lebih dulu — sama dengan pilihan "Terbaru" yang jadi bawaan
    // di halaman event, supaya susunan tidak bergeser sendiri sesudah kartu
    // pertama tergambar.
    .orderBy(desc(ccKegiatan.tanggalMulai))

  // Jumlah peserta per kegiatan, untuk menampilkan sisa kuota.
  const hitungan = await db
    .select({ kegiatanId: ccPeserta.kegiatanId, jumlah: sql<number>`count(*)` })
    .from(ccPeserta)
    .where(ne(ccPeserta.status, 'batal'))
    .groupBy(ccPeserta.kegiatanId)

  const pesertaPer = new Map(hitungan.map(h => [h.kegiatanId, h.jumlah]))

  // Cover diambil terpisah, bukan lewat join, karena `coverMediaId` sengaja tidak
  // memakai .references() (lihat design.md §5.2) — join-nya tidak dijamin ada.
  //
  // Thumbnail ikut diambil, tapi hanya sebagai CADANGAN — lihat catatan di
  // pemasangan `cover` di bawah.
  const coverIds = rows
    .flatMap(r => [r.thumbnailMediaId, r.coverMediaId])
    .filter((id): id is string => Boolean(id))
  const coverPer = new Map<string, string>()
  if (coverIds.length) {
    const media = await db
      .select({ id: ccMedia.id, publicUrl: ccMedia.publicUrl })
      .from(ccMedia)
      .where(inArray(ccMedia.id, coverIds))
    for (const m of media) coverPer.set(m.id, m.publicUrl)
  }

  // Kegiatan yang sudah didaftari user ini, supaya tombol "Daftar" tidak ditawarkan
  // dua kali. Server tetap menolak duplikat lewat unique index — ini hanya agar
  // penolakan itu tidak perlu ditemui pengguna.
  const user = await userSaatIni(event)
  const sudahDaftar = new Set<string>()
  if (user?.email) {
    const milikSaya = await db
      .select({ kegiatanId: ccPeserta.kegiatanId })
      .from(ccPeserta)
      .where(and(eq(ccPeserta.email, user.email), ne(ccPeserta.status, 'batal')))
    for (const row of milikSaya) sudahDaftar.add(row.kegiatanId)
  }

  const sekarang = new Date()
  const data = rows
    .map((row) => {
      const terdaftar = pesertaPer.get(row.id) ?? 0
      return {
        id: row.id,
        slug: row.slug,
        judul: row.judul,
        judulEn: row.judulEn,
        deskripsi: row.deskripsi,
        deskripsiEn: row.deskripsiEn,
        lokasi: row.lokasi,
        daring: Boolean(row.tautanDaring),
        // GAMBAR UTAMA yang didahulukan, bukan thumbnail.
        //
        // Urutannya dulu terbalik, dari zaman formulir masih meminta dua unggahan
        // terpisah — kartu memakai potongan 4:3-nya sendiri, halaman detail memakai
        // yang 16:9. Sejak formulirnya jadi satu unggahan, keduanya menunjuk media
        // yang sama dan urutannya tidak lagi berarti untuk event baru.
        //
        // Yang belum selesai adalah event LAMA yang telanjur menyimpan dua gambar
        // berbeda: kartunya menampilkan satu foto, halaman detailnya foto lain, dan
        // orang yang mengklik kartu merasa mendarat di acara yang salah. Dengan
        // `cover` didahulukan, keduanya selalu memperlihatkan gambar yang sama.
        // Thumbnail tetap jadi cadangan untuk baris lama yang justru hanya punya itu.
        cover: (row.coverMediaId ? coverPer.get(row.coverMediaId) : null)
          ?? (row.thumbnailMediaId ? coverPer.get(row.thumbnailMediaId) : null)
          ?? null,
        tanggalMulai: row.tanggalMulai,
        tanggalSelesai: row.tanggalSelesai,
        // Kolom teks bebas lama `waktu` tidak lagi dikirim: ia tidak bisa disunting
        // dari layar mana pun, sehingga event yang jamnya sengaja dikosongkan admin
        // tetap menampilkan jam warisan seed.
        jamMulai: row.jamMulai,
        jamSelesai: row.jamSelesai,
        tutupPendaftaran: row.tutupPendaftaran,
        // Untuk pilihan urutan "terbaru ditambahkan", yang berbeda dari tanggal
        // acaranya: event yang baru dimasukkan bisa saja acaranya paling lama.
        createdAt: row.createdAt,
        harga: row.harga,
        kuota: row.kuota,
        terdaftar,
        sisaKuota: row.kuota === null ? null : Math.max(0, row.kuota - terdaftar),
        fase: faseKegiatan(row, sekarang),
        pendaftaranTerbuka: pendaftaranTerbuka(row, sekarang) && (row.kuota === null || terdaftar < row.kuota),
        sudahTerdaftar: sudahDaftar.has(row.id),
      }
    })
    .filter(item => !faseDiminta.length || faseDiminta.includes(item.fase))

  return {
    data,
    meta: {
      total: data.length,
      // Hitungan per fase dikirim tanpa memedulikan filter fase yang sedang aktif,
      // supaya jumlah di samping setiap pilihan filter tidak ikut menyusut.
      perFase: rows.reduce<Record<string, number>>((acc, row) => {
        const f = faseKegiatan(row, sekarang)
        acc[f] = (acc[f] ?? 0) + 1
        return acc
      }, {}),
    },
  }
})
