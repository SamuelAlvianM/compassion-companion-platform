// server/api/admin/jurnal/index.get.ts
// Daftar jurnal untuk /admin/jurnal. Semua status ikut tampil — itu bedanya dari
// /api/jurnal publik, yang hanya mengenal yang sudah terbit.

import { desc, eq, like, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { db } from '../../../db'
import { ccJurnal, ccKegiatan, ccUser, JURNAL_STATUS, ROLE_LEVELS } from '../../../db/schema'
import { wajibRole } from '../../../utils/session'

export default defineEventHandler(async (event) => {
  const pengakses = await wajibRole(event, 'editor')
  const level = ROLE_LEVELS[pengakses.role]

  const q = getQuery(event)
  const cari = typeof q.cari === 'string' ? q.cari.trim() : ''
  const status = typeof q.status === 'string' ? q.status.trim() : ''
  const tipe = typeof q.tipe === 'string' ? q.tipe.trim() : ''

  const filters = []
  if (cari) {
    filters.push(or(
      like(ccJurnal.judul, `%${cari}%`),
      like(ccJurnal.kontributor, `%${cari}%`),
    )!)
  }
  if (status && status !== 'semua' && JURNAL_STATUS.includes(status as never)) {
    filters.push(eq(ccJurnal.status, status as never))
  }
  if (tipe && tipe !== 'semua') filters.push(eq(ccJurnal.tipe, tipe as never))

  const editorUser = alias(ccUser, 'editor_user')

  // Event dan penulis diambil lewat left join: keduanya opsional, dan inner join
  // akan menghilangkan jurnal yang tidak terikat event mana pun — yaitu sebagian
  // besar tipe insight dan practice.
  const rows = await db
    .select({
      id: ccJurnal.id,
      slug: ccJurnal.slug,
      judul: ccJurnal.judul,
      tipe: ccJurnal.tipe,
      status: ccJurnal.status,
      kontributor: ccJurnal.kontributor,
      kegiatanId: ccJurnal.kegiatanId,
      kegiatanJudul: ccKegiatan.judul,
      catatanRevisi: ccJurnal.catatanRevisi,
      diterbitkanPada: ccJurnal.diterbitkanPada,
      createdAt: ccJurnal.createdAt,
      updatedAt: ccJurnal.updatedAt,
      penulis: ccUser.fullName,
      editorId: ccJurnal.editorId,
      editorNama: editorUser.fullName,
    })
    .from(ccJurnal)
    .leftJoin(ccKegiatan, eq(ccJurnal.kegiatanId, ccKegiatan.id))
    .leftJoin(ccUser, eq(ccJurnal.dibuatOleh, ccUser.id))
    // Alias: `cc_user` sudah ikut sekali sebagai penulis. Tanpa alias, join kedua
    // ke tabel yang sama menimpa yang pertama.
    .leftJoin(editorUser, eq(ccJurnal.editorId, editorUser.id))
    .where(filters.length ? sql`${sql.join(filters, sql` and `)}` : undefined)
    .orderBy(desc(ccJurnal.updatedAt))

  // Hitungan per status dihitung TANPA saringan status yang sedang aktif — kalau
  // tidak, angka di samping tiap chip menyusut jadi nol begitu salah satu chip
  // ditekan. Saringan cari & tipe tetap ikut: angkanya memang harus menggambarkan
  // daftar yang sedang dilihat.
  const dasar = []
  if (cari) {
    dasar.push(or(like(ccJurnal.judul, `%${cari}%`), like(ccJurnal.kontributor, `%${cari}%`))!)
  }
  if (tipe && tipe !== 'semua') dasar.push(eq(ccJurnal.tipe, tipe as never))

  const hitung = await db
    .select({ status: ccJurnal.status, jumlah: sql<number>`count(*)` })
    .from(ccJurnal)
    .where(dasar.length ? sql`${sql.join(dasar, sql` and `)}` : undefined)
    .groupBy(ccJurnal.status)

  const perStatus = Object.fromEntries(JURNAL_STATUS.map(s => [s, 0])) as Record<string, number>
  let semua = 0
  for (const h of hitung) {
    perStatus[h.status] = h.jumlah
    semua += h.jumlah
  }

  // Tiap baris membawa kabar apakah PENGAKSES ini boleh menyuntingnya. Dihitung di
  // server, bukan ditebak di layar: aturannya sama dengan yang menolak permintaan
  // PATCH, jadi tombol yang tergambar tidak pernah berbeda dari yang diizinkan.
  //
  // Editor melihat SELURUH daftar — supaya ia tahu apa yang sedang dikerjakan
  // bersama — tapi hanya yang ditugaskan kepadanya yang bisa disentuh.
  const data = rows.map(r => ({
    ...r,
    milikSaya: level <= 2 || r.editorId === pengakses.id,
  }))

  return {
    data,
    meta: {
      total: data.length,
      perStatus: { ...perStatus, semua },
      // Berapa yang jadi tugas orang ini — dipakai penanda di layar editor.
      tugasSaya: data.filter(r => r.editorId === pengakses.id).length,
    },
  }
})
