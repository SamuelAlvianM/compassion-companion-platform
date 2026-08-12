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
  const coverIds = rows.map(r => r.coverMediaId).filter((id): id is string => Boolean(id))
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
        cover: row.coverMediaId ? coverPer.get(row.coverMediaId) ?? null : null,
        tanggalMulai: row.tanggalMulai,
        tanggalSelesai: row.tanggalSelesai,
        // `jamMulai`/`jamSelesai` adalah bentuk barunya; `waktu` teks bebas
        // ("09.00 – 16.30 WIB") tetap dikirim sebagai cadangan untuk event lama
        // yang kedua kolom jamnya masih kosong.
        jamMulai: row.jamMulai,
        jamSelesai: row.jamSelesai,
        waktu: row.waktu,
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
