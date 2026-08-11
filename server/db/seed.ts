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

// Isi halaman detail — `waktu`, `ajakan*`, `ajakanIsi*`, dan `testimoni` — dulu
// ditulis tetap di dalam tiga berkas `.vue` (kini di `.arsip/`). Dipindahkan ke
// sini supaya database yang baru di-seed langsung memuat halaman yang lengkap:
// tanpa ini, kolomnya kosong dan halaman detail event tampil setengah jadi —
// termasuk blok testimoni yang tidak pernah muncul karena `v-if="testimoni.length"`.
interface SeedKegiatan {
  slug: string
  judul: string
  judulEn: string
  deskripsi: string
  deskripsiEn: string
  lokasi: string
  waktu?: string
  ajakan?: string
  ajakanEn?: string
  ajakanIsi?: string
  ajakanIsiEn?: string
  testimoni?: { nama: string, teks: string }[]
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
    waktu: '09.00 – 16.00 WIB',
    ajakan: 'Mendengarkan, memahami, lalu melangkah bersama.',
    ajakanEn: 'Listening, understanding, then moving forward together.',
    ajakanIsi: 'Dalam perjumpaan ini para peserta berbagi pengalaman, berlatih memberi ruang bagi suara yang sering tidak terdengar, dan merefleksikan cara hadir bagi sesama.',
    ajakanIsiEn: 'In this gathering participants share their experiences, practise making room for voices that often go unheard, and reflect on how to be present for one another.',
    // Satu-satunya event yang benar-benar punya testimoni di halaman lamanya.
    // Empat event lain sengaja dibiarkan kosong: mengarang testimoni untuk acara
    // yang belum berjalan berarti menaruh kesaksian palsu di halaman publik.
    testimoni: [
      { nama: 'Nicholas', teks: 'Saya pulang dengan cara pandang baru: pemimpin tidak harus selalu menjadi orang pertama yang menjawab.' },
      { nama: 'Anna', teks: 'Saya merasa sungguh didengarkan dan belajar membawa kegelisahan saya dalam doa.' },
      { nama: 'Maria', teks: 'Ruang praktiknya membantu saya membawa kebiasaan mendengarkan ke komunitas.' },
    ],
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
    waktu: '19.00 – 21.00 WIB',
    ajakan: 'Mempraktikkan belas kasih dalam karya.',
    ajakanEn: 'Putting compassion to work.',
    ajakanIsi: 'Program berjalan dalam beberapa sesi. Peserta dapat mengikuti materi, recording, serta kegiatan practicum sesuai jadwal.',
    ajakanIsiEn: 'The programme runs across several sessions. Participants can follow the materials, the recordings, and the practicum activities as scheduled.',
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
    waktu: '09.00 – 16.30 WIB',
    ajakan: 'Menemukan cara memimpin yang lebih hadir.',
    ajakanEn: 'Finding a more present way to lead.',
    ajakanIsi: 'Melalui refleksi, dialog, dan latihan praktis, peserta diajak mengembangkan kehadiran yang penuh belas kasih untuk mendampingi orang lain dengan lebih bijaksana di tengah perubahan.',
    ajakanIsiEn: 'Through reflection, dialogue, and practical exercises, participants develop a compassionate presence to accompany others more wisely amid change.',
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
    waktu: '08.30 – 17.00 WIB',
    ajakan: 'Tetap mendampingi ketika arahnya belum jelas.',
    ajakanEn: 'Staying alongside people when the way ahead is unclear.',
    ajakanIsi: 'Dua hari untuk membaca perubahan yang sedang berlangsung di komunitas masing-masing, dan berlatih mengambil keputusan tanpa meninggalkan orang-orang yang terdampak.',
    ajakanIsiEn: 'Two days for reading the changes underway in your own community, and practising decisions that do not leave behind the people they affect.',
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
    waktu: 'Jumat 16.00 WIB – Minggu 12.00 WIB',
    ajakan: 'Merawat diri untuk kembali merawat sesama.',
    ajakanEn: 'Tending to yourself so you can tend to others again.',
    ajakanIsi: 'Retret hening tiga hari dengan pendampingan pribadi. Ruang untuk berhenti sejenak sebelum tahun berganti, bagi siapa pun yang pekerjaannya menuntut kehadiran terus-menerus.',
    ajakanIsiEn: 'A three-day silent retreat with personal accompaniment. Room to stop for a moment before the year turns, for anyone whose work demands constant presence.',
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
