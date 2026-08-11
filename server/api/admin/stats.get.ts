// server/api/admin/stats.get.ts
// Angka-angka untuk dashboard admin, dihitung langsung dari database.
//
// Dilindungi di level endpoint, bukan hanya lewat middleware halaman: middleware
// rute Nuxt tidak berlaku untuk /api/**, jadi tanpa pemeriksaan di sini siapa pun
// bisa membaca statistik cukup dengan memanggil URL-nya langsung.

import { sql } from 'drizzle-orm'
import { wajibRole } from '../../utils/session'
import { db } from '../../db'
import {
  ccUser,
  ccKegiatan,
  ccPeserta,
  ccTransaksiMaster,
  ccMedia,
  USER_ROLES,
  ROLE_LEVELS,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  KEGIATAN_STATUS,
  PESERTA_STATUS,
} from '../../db/schema'

/** Ubah hasil "group by" jadi objek lengkap, dengan 0 untuk kunci yang tidak muncul. */
const tally = <T extends string>(keys: readonly T[], rows: { key: string | null; jumlah: number }[]) => {
  const base = Object.fromEntries(keys.map((k) => [k, 0])) as Record<T, number>
  for (const row of rows) {
    if (row.key && row.key in base) base[row.key as T] = row.jumlah
  }
  return base
}

export default defineEventHandler(async (event) => {
  // Editor (level 3) ke atas boleh melihat ringkasan.
  const pengakses = await wajibRole(event, 'editor')
  // Rekap akun per role hanya untuk master. Disaring di sini, bukan cuma
  // disembunyikan di template — kalau hanya v-if, datanya tetap terkirim ke
  // browser admin/editor dan bisa dibaca dari devtools.
  const bolehLihatRole = pengakses.role === 'master'

  const jumlah = sql<number>`count(*)`.as('jumlah')

  const [userRows, kegiatanRows, pesertaRows, trxRows, mediaRow] = await Promise.all([
    db.select({ key: ccUser.role, jumlah }).from(ccUser).groupBy(ccUser.role),
    db.select({ key: ccKegiatan.status, jumlah }).from(ccKegiatan).groupBy(ccKegiatan.status),
    db.select({ key: ccPeserta.status, jumlah }).from(ccPeserta).groupBy(ccPeserta.status),
    db
      .select({
        key: ccTransaksiMaster.status,
        jumlah,
        nilai: sql<number>`coalesce(sum(${ccTransaksiMaster.total}), 0)`,
      })
      .from(ccTransaksiMaster)
      .groupBy(ccTransaksiMaster.status),
    db.select({ jumlah }).from(ccMedia),
  ])

  const perRole = tally(USER_ROLES, userRows)

  return {
    // Daftar role dikirim dari server supaya definisinya cuma hidup di satu tempat
    // (server/db/schema/users.ts) dan tidak perlu disalin ke sisi klien.
    roles: bolehLihatRole
      ? USER_ROLES.map((role) => ({
          role,
          level: ROLE_LEVELS[role],
          label: ROLE_LABELS[role],
          deskripsi: ROLE_DESCRIPTIONS[role],
          jumlah: perRole[role],
        }))
      : [],
    user: {
      total: userRows.reduce((n, r) => n + r.jumlah, 0),
      // Pecahan per role ikut disembunyikan dari non-master.
      perRole: bolehLihatRole ? perRole : undefined,
    },
    kegiatan: {
      total: kegiatanRows.reduce((n, r) => n + r.jumlah, 0),
      perStatus: tally(KEGIATAN_STATUS, kegiatanRows),
    },
    peserta: {
      total: pesertaRows.reduce((n, r) => n + r.jumlah, 0),
      perStatus: tally(PESERTA_STATUS, pesertaRows),
    },
    transaksi: {
      total: trxRows.reduce((n, r) => n + r.jumlah, 0),
      nilaiLunas: trxRows.find((r) => r.key === 'lunas')?.nilai ?? 0,
      menungguVerifikasi: trxRows.find((r) => r.key === 'menunggu_verifikasi')?.jumlah ?? 0,
    },
    media: { total: mediaRow[0]?.jumlah ?? 0 },
  }
})
