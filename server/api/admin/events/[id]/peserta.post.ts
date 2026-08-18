// server/api/admin/events/[id]/peserta.post.ts
// Menambahkan peserta dari dashboard — yang mendaftarnya di luar situs.
//
// Kenapa ini ada, padahal pendaftaran sudah punya jalannya sendiri
// (/api/events/[slug]/register.post.ts): sebagian orang membooking lewat WhatsApp,
// lewat panitia, atau di tempat. Sampai sekarang satu-satunya cara mencatat mereka
// adalah menyuruh mereka mendaftar ulang lewat halaman publik — pekerjaan yang
// diulang oleh orang yang sudah menyelesaikannya.
//
// Bedanya dengan pendaftaran publik, dan semuanya disengaja:
//
// - fase & pendaftaran tertutup TIDAK diperiksa. Yang mencatat di sini admin, dan
//   pendaftaran yang sudah ditutup justru keadaan paling lazim saat pencatatan
//   susulan dilakukan.
// - kuota TIDAK menolak. Kuota menahan pendaftaran publik supaya tidak melewati
//   daya tampung; admin yang menambahkan orang ke-31 tahu betul ia yang ke-31.
// - status boleh ditentukan. Bawaannya `konfirmasi` — orang yang dimasukkan tangan
//   admin biasanya sudah dihubungi dan sudah pasti ikut. Memaksanya mulai dari
//   `baru` berarti admin harus mengklik maju dua kali untuk keadaan yang sudah benar
//   sejak awal.
//
// Yang TIDAK dilonggarkan: satu email tetap hanya boleh sekali per kegiatan
// (unique index), dan formatnya tetap diperiksa — CHECK constraint di tabelnya akan
// menolaknya juga, tapi dengan pesan yang tidak bisa dibaca siapa pun.

import { eq } from 'drizzle-orm'
import { db } from '../../../../db'
import { ccKegiatan, ccPeserta, ccUser, PESERTA_STATUS, type PesertaStatus } from '../../../../db/schema'
import { wajibRole } from '../../../../utils/session'
import { salah } from '../../../../utils/validasi-event'

export default defineEventHandler(async (event) => {
  await wajibRole(event, 'editor')

  const kegiatanId = getRouterParam(event, 'id')
  if (!kegiatanId) throw salah('id kegiatan diperlukan')

  const kegiatan = db.select({ id: ccKegiatan.id }).from(ccKegiatan).where(eq(ccKegiatan.id, kegiatanId)).get()
  if (!kegiatan) throw createError({ statusCode: 404, statusMessage: 'Kegiatan tidak ditemukan' })

  const body = await readBody<Record<string, unknown>>(event) ?? {}
  const teks = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

  const nama = teks(body.nama)
  const email = teks(body.email).toLowerCase()
  if (!nama) throw salah('Nama peserta wajib diisi')
  if (!email) throw salah('Email peserta wajib diisi')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw salah('Format email tidak valid')

  const status = teks(body.status) || 'konfirmasi'
  if (!PESERTA_STATUS.includes(status as never)) throw salah(`Status tidak dikenal: ${status}`)

  // Akun dicari berdasarkan email, bukan diminta lewat body: kolom "Member" di
  // tabel peserta membaca `userId`, dan tanpa penautan ini orang yang sudah punya
  // akun akan muncul sebagai "Non member" — lalu ada yang membuatkannya akun kedua.
  const akun = db.select({ id: ccUser.id }).from(ccUser).where(eq(ccUser.email, email)).get()

  try {
    const peserta = db
      .insert(ccPeserta)
      .values({
        kegiatanId,
        userId: akun?.id ?? null,
        nama,
        email,
        noHp: teks(body.noHp) || null,
        institusi: teks(body.institusi) || null,
        catatan: teks(body.catatan) || null,
        status: status as PesertaStatus,
      })
      .returning()
      .get()

    setResponseStatus(event, 201)
    return { data: peserta }
  }
  catch (error) {
    if (String(error).includes('UNIQUE')) {
      throw createError({ statusCode: 409, statusMessage: 'Email ini sudah terdaftar di event tersebut.' })
    }
    throw error
  }
})
