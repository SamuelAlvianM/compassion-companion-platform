// server/db/seed.ts
// Dijalankan lewat `npm run db:seed` (tsx server/db/seed.ts).
//
// Sifatnya idempoten: menjalankannya berkali-kali tidak menggandakan baris.
// User dicocokkan berdasarkan `username`; yang sudah ada akan diperbarui
// (password + role + nama), yang belum ada dibuat baru.
//
// Password dibaca dari env (lihat .env.example), tidak pernah ditulis di berkas ini.
// Alasannya: berkas ini ikut ke git, dan password yang pernah ter-commit tetap ada
// di riwayat meski baris itu dihapus kemudian.

import { eq } from 'drizzle-orm'
import { db, sqlite } from './index'
import { ccUser, ccKegiatan, ROLE_LEVELS, type UserRole, type KegiatanStatus } from './schema'
import { hashPassword } from '../utils/password'

interface SeedUser {
  username: string
  password: string
  fullName: string
  email: string
  role: UserRole
}

// Dikumpulkan dulu sebelum ada baris yang ditulis, supaya env yang kurang satu
// tidak menyisakan database setengah ter-seed.
const wajibEnv = (nama: string): string => {
  const nilai = process.env[nama]
  if (!nilai) {
    console.error(
      `\n  ${nama} belum diisi.\n` +
        `  Salin .env.example jadi .env lalu isi password akun pengembangan.\n`,
    )
    process.exit(1)
  }
  return nilai
}

const USERS: SeedUser[] = [
  {
    username: 'master',
    password: wajibEnv('SEED_MASTER_PASSWORD'),
    fullName: 'Master Compassionate Companion',
    email: 'master@ignatianway.id',
    role: 'master',
  },
  {
    username: 'admin',
    password: wajibEnv('SEED_ADMIN_PASSWORD'),
    fullName: 'Admin Compassionate Companion',
    email: 'admin@ignatianway.id',
    role: 'admin',
  },
  {
    username: 'editor',
    password: wajibEnv('SEED_EDITOR_PASSWORD'),
    fullName: 'Editor Compassionate Companion',
    email: 'editor@ignatianway.id',
    role: 'editor',
  },
  {
    username: 'user',
    password: wajibEnv('SEED_USER_PASSWORD'),
    fullName: 'User Percobaan',
    email: 'user@ignatianway.id',
    role: 'user',
  },
]

// ── Kegiatan ─────────────────────────────────────────────────────────────────
// Fase (mendatang/berlangsung/selesai) TIDAK disimpan; ia diturunkan dari tanggal
// saat dibaca — lihat server/utils/kegiatan.ts. Kolom `status` di sini adalah
// keadaan redaksional (draft/terbit/selesai/batal), bukan fase waktu.
const d = (iso: string) => new Date(`${iso}T00:00:00+07:00`)

interface SeedKegiatan {
  slug: string
  judul: string
  judulEn: string
  deskripsi: string
  deskripsiEn: string
  lokasi: string
  tautanDaring?: string
  tanggalMulai: Date
  tanggalSelesai?: Date
  tutupPendaftaran?: Date
  kuota?: number
  harga: number
  status: KegiatanStatus
}

const KEGIATAN: SeedKegiatan[] = [
  {
    slug: 'listening-as-leadership',
    judul: 'Listening as Leadership',
    judulEn: 'Listening as Leadership',
    deskripsi: 'Belajar memimpin melalui kehadiran dan seni mendengarkan.',
    deskripsiEn: 'Learning to lead through presence and the art of listening.',
    lokasi: 'Online via Zoom',
    tautanDaring: 'https://zoom.us/j/000000000',
    tanggalMulai: d('2026-05-18'),
    tanggalSelesai: d('2026-05-19'),
    tutupPendaftaran: d('2026-05-15'),
    kuota: 40,
    harga: 0,
    status: 'selesai',
  },
  {
    slug: 'compassion-in-practice',
    judul: 'Compassion in Practice',
    judulEn: 'Compassion in Practice',
    deskripsi: 'Rangkaian pembelajaran dan practicum untuk membawa belas kasih ke dalam kepemimpinan sehari-hari.',
    deskripsiEn: 'A series of learning sessions and practicums for bringing compassion into everyday leadership.',
    lokasi: 'Online via Zoom',
    tautanDaring: 'https://zoom.us/j/000000001',
    tanggalMulai: d('2026-08-04'),
    tanggalSelesai: d('2026-08-25'),
    tutupPendaftaran: d('2026-08-02'),
    kuota: 30,
    harga: 250000,
    status: 'terbit',
  },
  {
    slug: 'leadership-with-compassion',
    judul: 'Leadership with Compassion',
    judulEn: 'Leadership with Compassion',
    deskripsi: 'Lokakarya satu hari untuk bertumbuh dalam kepemimpinan yang hadir dan penuh kasih.',
    deskripsiEn: 'A one-day workshop for growing into leadership that is present and full of care.',
    lokasi: 'Jakarta · Rumah Retret St. Ignatius',
    tanggalMulai: d('2026-08-12'),
    tanggalSelesai: d('2026-08-12'),
    tutupPendaftaran: d('2026-08-12'),
    kuota: 35,
    harga: 350000,
    status: 'terbit',
  },
  {
    slug: 'leading-through-change',
    judul: 'Leading Through Change',
    judulEn: 'Leading Through Change',
    deskripsi: 'Mendampingi komunitas dan karya saat segalanya sedang berubah.',
    deskripsiEn: 'Accompanying communities and ministries while everything is shifting.',
    lokasi: 'Yogyakarta · Wisma Sangkal Putung',
    tanggalMulai: d('2026-09-18'),
    tanggalSelesai: d('2026-09-19'),
    tutupPendaftaran: d('2026-09-14'),
    kuota: 25,
    harga: 450000,
    status: 'terbit',
  },
  {
    slug: 'retret-adven-cura-personalis',
    judul: 'Retret Adven: Cura Personalis',
    judulEn: 'Advent Retreat: Cura Personalis',
    deskripsi: 'Hening bersama menjelang Natal, merawat diri untuk kembali merawat sesama.',
    deskripsiEn: 'Shared silence before Christmas — tending to yourself so you can tend to others.',
    lokasi: 'Bogor · Rumah Retret Bukit Damai',
    tanggalMulai: d('2026-12-05'),
    tanggalSelesai: d('2026-12-07'),
    tutupPendaftaran: d('2026-11-28'),
    kuota: 20,
    harga: 600000,
    status: 'terbit',
  },
]

const seed = async () => {
  console.log('Seeding database…\n')

  for (const item of USERS) {
    const password = await hashPassword(item.password)
    const existing = db.select({ id: ccUser.id }).from(ccUser).where(eq(ccUser.username, item.username)).get()

    if (existing) {
      db.update(ccUser)
        .set({ password, fullName: item.fullName, email: item.email, role: item.role, isActive: true })
        .where(eq(ccUser.id, existing.id))
        .run()
      console.log(`  ~ diperbarui  ${item.username.padEnd(7)} role=${item.role.padEnd(6)} level=${ROLE_LEVELS[item.role]}`)
    } else {
      const [created] = db
        .insert(ccUser)
        .values({ ...item, password })
        .returning({ id: ccUser.id })
        .all()
      console.log(`  + dibuat      ${item.username.padEnd(7)} role=${item.role.padEnd(6)} level=${ROLE_LEVELS[item.role]}  id=${created!.id}`)
    }
  }

  console.log('')
  for (const item of KEGIATAN) {
    const existing = db
      .select({ id: ccKegiatan.id })
      .from(ccKegiatan)
      .where(eq(ccKegiatan.slug, item.slug))
      .get()

    if (existing) {
      db.update(ccKegiatan).set(item).where(eq(ccKegiatan.id, existing.id)).run()
      console.log(`  ~ diperbarui  ${item.slug}`)
    } else {
      db.insert(ccKegiatan).values(item).run()
      console.log(`  + dibuat      ${item.slug}`)
    }
  }

  const totalUser = db.select({ id: ccUser.id }).from(ccUser).all().length
  const totalKegiatan = db.select({ id: ccKegiatan.id }).from(ccKegiatan).all().length
  console.log(`\nSelesai. User: ${totalUser}, kegiatan: ${totalKegiatan}`)
  console.log('Kredensial pengembangan — ganti sebelum dipakai di produksi.')
}

seed()
  .then(() => sqlite.close())
  .catch((error) => {
    console.error('\nSeed gagal:', error)
    sqlite.close()
    process.exit(1)
  })
