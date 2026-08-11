// server/api/users/index.get.ts
// Daftar user untuk pengelola. Hanya level <= 3 (master, admin, editor).
//
// Query: q (cari nama/username/email), role, aktif (true|false), page, limit

import { and, desc, eq, like, or, sql, type SQL } from 'drizzle-orm'
import { db } from '../../db'
import { ccUser, ccPeserta, USER_ROLES, ROLE_LEVELS, ROLE_LABELS, type UserRole } from '../../db/schema'
import { wajibRole } from '../../utils/session'

export default defineEventHandler(async (event) => {
  await wajibRole(event, 'editor')

  const q = getQuery(event)
  const kunci = typeof q.q === 'string' ? q.q.trim().toLowerCase() : ''
  const role = typeof q.role === 'string' && USER_ROLES.includes(q.role as UserRole)
    ? (q.role as UserRole)
    : undefined
  const page = Math.max(1, Number(q.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(q.limit) || 25))

  const filters: SQL[] = []
  if (kunci) {
    const pola = `%${kunci}%`
    filters.push(
      or(
        like(sql`lower(${ccUser.fullName})`, pola),
        like(sql`lower(${ccUser.username})`, pola),
        like(sql`lower(${ccUser.email})`, pola),
      )!,
    )
  }
  if (role) filters.push(eq(ccUser.role, role))
  if (q.aktif === 'true') filters.push(eq(ccUser.isActive, true))
  if (q.aktif === 'false') filters.push(eq(ccUser.isActive, false))

  const where = filters.length ? and(...filters) : undefined

  const rows = await db
    .select({
      id: ccUser.id,
      username: ccUser.username,
      fullName: ccUser.fullName,
      email: ccUser.email,
      role: ccUser.role,
      phoneNumber: ccUser.phoneNumber,
      isActive: ccUser.isActive,
      lastLogin: ccUser.lastLogin,
      createdAt: ccUser.createdAt,
    })
    .from(ccUser)
    .where(where)
    .orderBy(desc(ccUser.createdAt))
    .limit(limit)
    .offset((page - 1) * limit)

  // Jumlah kegiatan yang pernah diikuti, dicocokkan lewat email supaya pendaftaran
  // tamu (userId null) yang dibuat sebelum punya akun tetap terhitung.
  const ikut = await db
    .select({ email: ccPeserta.email, jumlah: sql<number>`count(*)` })
    .from(ccPeserta)
    .groupBy(ccPeserta.email)
  const ikutPer = new Map(ikut.map(i => [i.email, i.jumlah]))

  const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(ccUser).where(where)

  return {
    data: rows.map(row => ({
      ...row,
      level: ROLE_LEVELS[row.role],
      roleLabel: ROLE_LABELS[row.role],
      jumlahKegiatan: row.email ? (ikutPer.get(row.email) ?? 0) : 0,
    })),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    opsi: {
      roles: USER_ROLES.map(r => ({ value: r, label: `${ROLE_LABELS[r]} — level ${ROLE_LEVELS[r]}` })),
    },
  }
})
