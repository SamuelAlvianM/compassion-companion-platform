// server/api/admin/events/[id]/peserta.get.ts
// Daftar pendaftar satu kegiatan, untuk tab "Daftar peserta" di halaman event admin.
//
// Tidak ada endpoint pendaftar global: satu pendaftaran selalu milik satu kegiatan,
// dan daftar lintas-kegiatan tanpa konteks eventnya tidak bisa dikerjakan admin —
// keputusan "sudah bayar belum" selalu ditanyakan per kegiatan.

import { and, desc, eq, like, or, sql } from 'drizzle-orm'
import { db } from '../../../../db'
import { ccPeserta, PESERTA_STATUS, type PesertaStatus } from '../../../../db/schema'
import { wajibRole } from '../../../../utils/session'

export default defineEventHandler(async (event) => {
  await wajibRole(event, 'editor')

  const kegiatanId = getRouterParam(event, 'id')
  if (!kegiatanId) throw createError({ statusCode: 400, statusMessage: 'ID kegiatan wajib diisi.' })

  const q = getQuery(event)
  const cari = String(q.cari ?? '').trim()
  const statusDiminta = String(q.status ?? '').trim()

  const filters = [eq(ccPeserta.kegiatanId, kegiatanId)]

  // 'semua' bukan status; ia ketiadaan filter. Sentinel dipakai supaya nilai kosong
  // tetap bisa berarti "belum dipilih" di sisi klien.
  if (statusDiminta && statusDiminta !== 'semua') {
    if (!PESERTA_STATUS.includes(statusDiminta as PesertaStatus)) {
      throw createError({ statusCode: 400, statusMessage: 'Status tidak dikenal.' })
    }
    filters.push(eq(ccPeserta.status, statusDiminta as PesertaStatus))
  }

  if (cari) {
    const pola = `%${cari}%`
    filters.push(or(like(ccPeserta.nama, pola), like(ccPeserta.email, pola))!)
  }

  const rows = await db
    .select({
      id: ccPeserta.id,
      nama: ccPeserta.nama,
      email: ccPeserta.email,
      noHp: ccPeserta.noHp,
      institusi: ccPeserta.institusi,
      catatan: ccPeserta.catatan,
      status: ccPeserta.status,
      statusSebelumBatal: ccPeserta.statusSebelumBatal,
      userId: ccPeserta.userId,
      terdaftarPada: ccPeserta.terdaftarPada,
      hadirPada: ccPeserta.hadirPada,
    })
    .from(ccPeserta)
    .where(and(...filters))
    .orderBy(desc(ccPeserta.terdaftarPada))

  // Hitungan dihitung tanpa memedulikan filter status yang sedang aktif, supaya
  // angka di samping tiap tab tidak ikut menyusut begitu satu tab dipilih.
  const hitungRows = await db
    .select({ status: ccPeserta.status, jumlah: sql<number>`count(*)` })
    .from(ccPeserta)
    .where(eq(ccPeserta.kegiatanId, kegiatanId))
    .groupBy(ccPeserta.status)

  const perStatus = Object.fromEntries(PESERTA_STATUS.map(s => [s, 0])) as Record<PesertaStatus, number>
  let semua = 0
  for (const r of hitungRows) {
    perStatus[r.status] = r.jumlah
    semua += r.jumlah
  }

  return {
    data: rows.map(r => ({
      ...r,
      // Dibedakan di payload, bukan ditebak dari userId di klien: pendaftar berakun
      // punya identitas yang sudah terverifikasi dan itu memengaruhi keputusan admin.
      berakun: Boolean(r.userId),
    })),
    meta: { total: rows.length, perStatus: { semua, ...perStatus } },
  }
})
