// server/api/admin/peserta/[id].patch.ts
// Perpindahan status pendaftar. Semuanya manual — tidak ada status yang berubah
// sendiri karena waktu atau karena pembayaran masuk.
//
// Yang dikirim klien adalah AKSI ('maju' / 'batal' / 'pulihkan'), bukan status
// tujuan. Bedanya penting: kalau klien boleh menyebut status tujuan, ia bisa
// melompat dari `baru` langsung ke `konfirmasi` dan melewati verifikasi — dan
// tombol yang disembunyikan di UI tidak menahan permintaan yang disusun sendiri.
// Dengan aksi, aturan urutannya hanya hidup di satu tempat: berkas ini.

import { and, eq, ne, sql } from 'drizzle-orm'
import { db } from '../../../db'
import { ccPeserta, ccKegiatan, statusBerikutnya } from '../../../db/schema'
import { wajibRole } from '../../../utils/session'

const AKSI = ['maju', 'batal', 'pulihkan'] as const
type Aksi = (typeof AKSI)[number]

export default defineEventHandler(async (event) => {
  await wajibRole(event, 'editor')

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID peserta wajib diisi.' })

  const body = await readBody<{ aksi?: string }>(event)
  const aksi = body?.aksi as Aksi | undefined
  if (!aksi || !AKSI.includes(aksi)) {
    throw createError({ statusCode: 400, statusMessage: 'Aksi harus salah satu dari: maju, batal, pulihkan.' })
  }

  const peserta = db.select().from(ccPeserta).where(eq(ccPeserta.id, id)).get()
  if (!peserta) throw createError({ statusCode: 404, statusMessage: 'Pendaftar tidak ditemukan.' })

  let status = peserta.status
  let statusSebelumBatal = peserta.statusSebelumBatal

  if (aksi === 'maju') {
    if (peserta.status === 'batal') {
      throw createError({
        statusCode: 409,
        statusMessage: 'Pendaftar ini sudah dibatalkan. Pulihkan dulu sebelum melanjutkan.',
      })
    }
    const lanjut = statusBerikutnya(peserta.status)
    if (!lanjut) {
      throw createError({ statusCode: 409, statusMessage: 'Pendaftar ini sudah pada status terakhir.' })
    }
    status = lanjut
  }

  if (aksi === 'batal') {
    if (peserta.status === 'batal') {
      throw createError({ statusCode: 409, statusMessage: 'Pendaftar ini sudah dibatalkan.' })
    }
    // Status saat ini disimpan supaya pembatalan bisa dianulir tanpa menebak
    // sudah sejauh mana pendaftar ini pernah diproses.
    statusSebelumBatal = peserta.status
    status = 'batal'
  }

  if (aksi === 'pulihkan') {
    if (peserta.status !== 'batal') {
      throw createError({ statusCode: 409, statusMessage: 'Hanya pendaftar yang dibatalkan yang bisa dipulihkan.' })
    }

    // Kuota diperiksa ulang di sini. Pendaftar batal tidak ikut dihitung, jadi
    // memulihkannya bisa membuat kegiatan melewati batas — dan itu baru ketahuan
    // di hari acara kalau tidak dijaga sekarang.
    const kegiatan = db.select().from(ccKegiatan).where(eq(ccKegiatan.id, peserta.kegiatanId)).get()
    if (kegiatan?.kuota !== null && kegiatan?.kuota !== undefined) {
      // Baris[0] bertipe undefined menurut tipe hasil drizzle meski `count(*)`
      // selalu mengembalikan tepat satu baris; `?? 0` menuruti tipenya.
      const hitung = await db
        .select({ jumlah: sql<number>`count(*)` })
        .from(ccPeserta)
        .where(and(eq(ccPeserta.kegiatanId, peserta.kegiatanId), ne(ccPeserta.status, 'batal')))
      const jumlah = hitung[0]?.jumlah ?? 0

      if (jumlah >= kegiatan.kuota) {
        throw createError({
          statusCode: 409,
          statusMessage: 'Kuota kegiatan sudah penuh, pendaftar ini tidak bisa dipulihkan.',
        })
      }
    }

    // Kembali ke status terakhir sebelum batal. Jatuh ke 'baru' hanya untuk baris
    // lama yang dibatalkan sebelum kolom ini ada.
    status = peserta.statusSebelumBatal ?? 'baru'
    statusSebelumBatal = null
  }

  const [hasil] = db
    .update(ccPeserta)
    .set({ status, statusSebelumBatal })
    .where(eq(ccPeserta.id, id))
    .returning()
    .all()

  return { data: { id: hasil!.id, status: hasil!.status, statusSebelumBatal: hasil!.statusSebelumBatal } }
})
