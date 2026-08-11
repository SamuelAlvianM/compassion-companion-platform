// server/api/events/[slug]/register.post.ts
// Mendaftarkan seseorang ke sebuah kegiatan.
//
// Dua jalur masuk:
//   1. Sudah login  -> nama/email/no HP diambil dari akun. Body boleh kosong,
//                      inilah yang membuat "daftar 1x klik" mungkin.
//   2. Tamu         -> nama + email wajib dikirim di body.
//
// Semua pemeriksaan (fase, kuota, duplikat) dilakukan di server. Tombol yang
// dinonaktifkan di UI hanya kenyamanan, bukan pengaman.

import { and, eq, ne, sql } from 'drizzle-orm'
import { db } from '../../../db'
import { ccKegiatan, ccPeserta } from '../../../db/schema'
import { pendaftaranTerbuka, faseKegiatan } from '../../../utils/kegiatan'
import { userSaatIni } from '../../../utils/session'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Slug kegiatan diperlukan' })

  const kegiatan = db.select().from(ccKegiatan).where(eq(ccKegiatan.slug, slug)).get()
  if (!kegiatan) throw createError({ statusCode: 404, statusMessage: 'Kegiatan tidak ditemukan' })

  if (!pendaftaranTerbuka(kegiatan)) {
    const fase = faseKegiatan(kegiatan)
    const alasan = fase === 'selesai'
      ? 'Kegiatan ini sudah selesai.'
      : fase === 'batal'
        ? 'Kegiatan ini dibatalkan.'
        : 'Pendaftaran untuk kegiatan ini sudah ditutup.'
    throw createError({ statusCode: 409, statusMessage: alasan })
  }

  const user = await userSaatIni(event)
  const body = await readBody<{
    nama?: string
    email?: string
    noHp?: string
    institusi?: string
    catatan?: string
  }>(event).catch(() => ({}))

  const nama = (body?.nama ?? user?.fullName ?? '').trim()
  const email = (body?.email ?? user?.email ?? '').trim().toLowerCase()

  if (!nama || !email) {
    throw createError({ statusCode: 400, statusMessage: 'Nama dan email wajib diisi' })
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw createError({ statusCode: 400, statusMessage: 'Format email tidak valid' })
  }

  // Kuota diperiksa tepat sebelum menulis. Tetap ada celah balapan yang sangat kecil;
  // yang menjaga dari duplikat adalah unique index (kegiatan_id, email) di bawah.
  if (kegiatan.kuota !== null) {
    const [{ jumlah }] = await db
      .select({ jumlah: sql<number>`count(*)` })
      .from(ccPeserta)
      .where(and(eq(ccPeserta.kegiatanId, kegiatan.id), ne(ccPeserta.status, 'batal')))

    if (jumlah >= kegiatan.kuota) {
      throw createError({ statusCode: 409, statusMessage: 'Kuota kegiatan sudah penuh.' })
    }
  }

  try {
    const [peserta] = db
      .insert(ccPeserta)
      .values({
        kegiatanId: kegiatan.id,
        userId: user?.id ?? null,
        nama,
        email,
        noHp: body?.noHp?.trim() || null,
        institusi: body?.institusi?.trim() || null,
        catatan: body?.catatan?.trim() || null,
        // Pendaftar berakun mulai dari `proses`, bukan `baru`: nama dan emailnya
        // datang dari akun yang sudah terverifikasi, jadi langkah "periksa dulu
        // orangnya siapa" sudah lewat — yang tersisa tinggal konfirmasi admin.
        // Pendaftar tamu mulai dari `baru` karena datanya belum diperiksa siapa pun.
        status: user ? 'proses' : 'baru',
      })
      .returning()
      .all()

    setResponseStatus(event, 201)
    return {
      status: 201,
      message: kegiatan.harga === 0
        ? 'Pendaftaran diterima. Sampai jumpa di kegiatan!'
        : 'Pendaftaran diterima. Admin akan menghubungi Anda untuk pembayaran.',
      data: { id: peserta!.id, status: peserta!.status, nama: peserta!.nama, email: peserta!.email },
    }
  } catch (error) {
    // Unique index uq_peserta_kegiatan_email — satu email hanya sekali per kegiatan.
    if (String(error).includes('UNIQUE')) {
      throw createError({ statusCode: 409, statusMessage: 'Email ini sudah terdaftar di kegiatan tersebut.' })
    }
    throw error
  }
})
