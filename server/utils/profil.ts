// server/utils/profil.ts
// Penyusun payload profil, dipakai oleh /api/users/me dan /api/users/[id].
//
// Dipisahkan karena keduanya harus mengembalikan bentuk yang sama persis —
// halaman profil memakai satu komponen untuk "profil saya" dan "profil orang lain".

import { desc, eq } from 'drizzle-orm'
import { db } from '../db'
import {
  ccUser,
  ccRefleksi,
  ccKegiatan,
  ccMedia,
  ROLE_LEVELS,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
} from '../db/schema'
import { riwayatKegiatan } from './riwayat'
import type { SessionUser } from './session'

export const bangunProfil = async (pengakses: SessionUser, targetIdMentah: string) => {
  const sendiri = targetIdMentah === 'me' || targetIdMentah === pengakses.id
  const targetId = sendiri ? pengakses.id : targetIdMentah

  // Hanya pengelola (level <= 3) yang boleh melihat profil orang lain.
  if (!sendiri && ROLE_LEVELS[pengakses.role] > 3) {
    throw createError({ statusCode: 403, statusMessage: 'Wewenang tidak mencukupi' })
  }

  const user = db
    .select({
      id: ccUser.id,
      username: ccUser.username,
      fullName: ccUser.fullName,
      email: ccUser.email,
      role: ccUser.role,
      phoneNumber: ccUser.phoneNumber,
      isActive: ccUser.isActive,
      // Ikut dikirim supaya sakelar "Boleh menulis jurnal" di formulir member
      // menampilkan keadaan yang sebenarnya, bukan selalu mati.
      bolehTulisJurnal: ccUser.bolehTulisJurnal,
      avatarMediaId: ccUser.avatarMediaId,
      lastLogin: ccUser.lastLogin,
      createdAt: ccUser.createdAt,
    })
    .from(ccUser)
    .where(eq(ccUser.id, targetId))
    .get()

  if (!user) throw createError({ statusCode: 404, statusMessage: 'User tidak ditemukan' })

  const riwayat = await riwayatKegiatan(user.id, user.email)

  const refleksiRows = await db
    .select({
      id: ccRefleksi.id,
      isi: ccRefleksi.isi,
      visibilitas: ccRefleksi.visibilitas,
      createdAt: ccRefleksi.createdAt,
      kegiatanSlug: ccKegiatan.slug,
      kegiatanJudul: ccKegiatan.judul,
      gambar: ccMedia.publicUrl,
    })
    .from(ccRefleksi)
    .leftJoin(ccKegiatan, eq(ccRefleksi.kegiatanId, ccKegiatan.id))
    .leftJoin(ccMedia, eq(ccRefleksi.mediaId, ccMedia.id))
    .where(eq(ccRefleksi.userId, user.id))
    .orderBy(desc(ccRefleksi.createdAt))

  // Refleksi `pribadi` hanya untuk penulisnya sendiri dan pengelola level <= 2.
  const bolehLihatPribadi = sendiri || ROLE_LEVELS[pengakses.role] <= 2

  return {
    user: {
      ...user,
      level: ROLE_LEVELS[user.role],
      roleLabel: ROLE_LABELS[user.role],
      roleDeskripsi: ROLE_DESCRIPTIONS[user.role],
    },
    sendiri,
    riwayat: riwayat.data,
    ringkas: riwayat.ringkas,
    refleksi: refleksiRows.filter(r => r.visibilitas !== 'pribadi' || bolehLihatPribadi),
  }
}
