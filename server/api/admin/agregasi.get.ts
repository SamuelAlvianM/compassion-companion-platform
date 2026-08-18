// server/api/admin/agregasi.get.ts
// Agregasi penuh untuk dashboard admin — satu permintaan, semua sudut pandang.
//
// Berbeda dari `stats.get.ts` yang hanya menghitung total per tabel, endpoint ini
// menyilangkan tabelnya: pendaftar per event per status, pendaftaran per bulan per
// event, kapasitas terpakai, isi materi per event. Itu yang membuat grafiknya bisa
// ditelusuri — tiap batang, irisan, dan titik membawa daftar baris pembentuknya,
// jadi "kenapa angkanya segini" dijawab di halaman yang sama, bukan dengan pindah
// halaman lalu menghitung ulang sendiri.
//
// Kenapa sebagian agregasi dilakukan di JS, bukan seluruhnya di SQL:
//
//   1. FASE tidak ada di database. Ia dihitung dari tanggal terhadap "sekarang"
//      (lihat utils/kegiatan.ts), jadi tidak ada kolom yang bisa di-GROUP BY.
//   2. EMBER BULAN harus dalam waktu Jakarta. `strftime` SQLite bekerja di UTC;
//      pendaftaran pukul 06.00 WIB tanggal 1 akan jatuh ke bulan sebelumnya pada
//      pergantian bulan. Drizzle mengembalikan kolom timestamp sebagai `Date`,
//      jadi pengemberan di JS memakai zona waktu yang benar tanpa menebak satuan
//      penyimpanan (detik vs milidetik) yang jadi sumber salah hitung klasik.
//
// Barisnya sendiri sedikit — event puluhan, pendaftar ratusan — jadi harganya
// sebatas satu SELECT tanpa GROUP BY, dan yang ditukar dengan itu adalah dua kelas
// kesalahan yang tidak menimbulkan error, hanya angka yang salah diam-diam.

import { desc, eq, ne, sql } from 'drizzle-orm'
import { db } from '../../db'
import {
  ccKegiatan,
  ccKunjungan,
  ccMedia,
  ccPengunjung,
  ccPeserta,
  ccSesi,
  ccSesiItem,
  ccUser,
  PESERTA_STATUS,
  ROLE_LABELS,
  ROLE_LEVELS,
  USER_ROLES,
  type PesertaStatus,
} from '../../db/schema'
import { JURNAL } from '#shared/jurnal'
import { faseKegiatan, type Fase } from '../../utils/kegiatan'
import { wajibRole } from '../../utils/session'

const FASE: Fase[] = ['mendatang', 'berlangsung', 'selesai', 'batal']

/** Ember bulan dalam waktu Jakarta, mis. "2026-08". Lihat catatan kepala berkas. */
const bulanJakarta = (tanggal: Date) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit' })
    .format(tanggal)
    .slice(0, 7)

const LABEL_BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

const labelBulan = (kunci: string) => {
  const [tahun, bulan] = kunci.split('-')
  return `${LABEL_BULAN[Number(bulan) - 1] ?? bulan} ${tahun}`
}

/** Deret 12 bulan terakhir sampai bulan berjalan — termasuk yang nol.
    Bulan kosong sengaja tetap ada: garis yang melompati bulan sepi menggambarkan
    kenaikan yang tidak pernah terjadi. */
const rangkaBulan = (sekarang: Date, panjang = 12) => {
  const kunci: string[] = []
  for (let i = panjang - 1; i >= 0; i--) {
    kunci.push(bulanJakarta(new Date(sekarang.getFullYear(), sekarang.getMonth() - i, 15)))
  }
  return kunci
}

const nolStatus = () =>
  Object.fromEntries(PESERTA_STATUS.map(s => [s, 0])) as Record<PesertaStatus, number>

/** Hari menurut waktu Jakarta, `YYYY-MM-DD`. */
const hariJakarta = (t: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(t)

/**
 * Kunci minggu ISO, `2026-W33`.
 *
 * Dihitung dari hari Kamis pada minggu yang sama — aturan ISO — supaya minggu yang
 * melintasi pergantian tahun tidak terpecah jadi dua nomor yang keduanya salah.
 */
const mingguIso = (t: Date) => {
  const d = new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const awalTahun = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const nomor = Math.ceil(((d.getTime() - awalTahun.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(nomor).padStart(2, '0')}`
}

/**
 * Kelompokkan sesuatu ke dalam ember waktu, lalu kembalikan yang terisi saja,
 * terurut menaik.
 *
 * Berbeda dari `rangkaBulan` yang sengaja menyertakan bulan nol: di sana garisnya
 * harus menggambarkan waktu yang berjalan, di sini batangnya menjawab "berapa
 * banyak dan kapan". Minggu-minggu kosong sepanjang setahun akan membuat tiap
 * batang setipis garis.
 */
const kelompokkan = <T>(baris: T[], kunciDari: (x: T) => string, labelDari: (k: string) => string) => {
  const per = new Map<string, T[]>()
  for (const b of baris) {
    const k = kunciDari(b)
    per.set(k, [...(per.get(k) ?? []), b])
  }
  return [...per.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([kunci, isi]) => ({ kunci, label: labelDari(kunci), jumlah: isi.length, isi }))
}

export default defineEventHandler(async (event) => {
  const pengakses = await wajibRole(event, 'editor')
  // Rekap akun per role hanya untuk master — disaring di server, bukan disembunyikan
  // di template, mengikuti pola yang sama di stats.get.ts.
  const bolehLihatRole = pengakses.role === 'master'

  const sekarang = new Date()
  const jumlah = sql<number>`count(*)`.as('jumlah')

  const [kegiatanRows, pesertaRows, itemRows, sesiRows, mediaRows, userRows] = await Promise.all([
    db
      .select({
        id: ccKegiatan.id,
        judul: ccKegiatan.judul,
        slug: ccKegiatan.slug,
        status: ccKegiatan.status,
        tanggalMulai: ccKegiatan.tanggalMulai,
        tanggalSelesai: ccKegiatan.tanggalSelesai,
        kuota: ccKegiatan.kuota,
      })
      .from(ccKegiatan)
      .orderBy(desc(ccKegiatan.tanggalMulai)),

    db
      .select({
        kegiatanId: ccPeserta.kegiatanId,
        status: ccPeserta.status,
        terdaftarPada: ccPeserta.terdaftarPada,
        // Dipakai menghitung ORANG, bukan pendaftaran — satu orang bisa punya
        // beberapa baris di sini.
        email: ccPeserta.email,
      })
      .from(ccPeserta),

    // Isi materi per event: item digantung pada sesi, sesi pada kegiatan, jadi
    // hitungannya harus lewat join — bukan kolom di kegiatan.
    db
      .select({ kegiatanId: ccSesi.kegiatanId, bagian: ccSesiItem.bagian, jumlah })
      .from(ccSesiItem)
      .innerJoin(ccSesi, eq(ccSesiItem.sesiId, ccSesi.id))
      .groupBy(ccSesi.kegiatanId, ccSesiItem.bagian),

    db.select({ kegiatanId: ccSesi.kegiatanId, jumlah }).from(ccSesi).groupBy(ccSesi.kegiatanId),

    // Berkas dibawa satu per satu, bukan cuma hitungannya: video dan dokumen di
    // dashboard bisa dibuka daftarnya, dan daftarnya butuh nama serta alamat tiap
    // berkas. `fileData` TIDAK ikut dipilih — blobnya bisa ratusan MB.
    db
      .select({
        id: ccMedia.id,
        kind: ccMedia.kind,
        nama: ccMedia.originalName,
        mime: ccMedia.mimeType,
        bytes: ccMedia.fileSize,
        url: ccMedia.publicUrl,
        diunggahPada: ccMedia.uploadedAt,
      })
      .from(ccMedia)
      .orderBy(desc(ccMedia.uploadedAt)),

    db.select({ role: ccUser.role, jumlah }).from(ccUser).groupBy(ccUser.role),
  ])

  // Kunjungan situs publik. Dua angka dari dua tabel: berapa kali halaman dibuka,
  // dan berapa ORANG per hari. Keduanya tanpa data pribadi apa pun — lihat
  // server/db/schema/kunjungan.ts.
  const [kunjunganRows, pengunjungRows] = await Promise.all([
    db
      .select({ tanggal: ccKunjungan.tanggal, jumlah: ccKunjungan.jumlah })
      .from(ccKunjungan),
    db
      .select({ tanggal: ccPengunjung.tanggal, jumlah })
      .from(ccPengunjung)
      .groupBy(ccPengunjung.tanggal),
  ])

  // ── Silang: event × status, event × bulan ──────────────────────────────────
  const perEventStatus = new Map<string, Record<PesertaStatus, number>>()
  const perBulan = new Map<string, Map<string, number>>()

  for (const p of pesertaRows) {
    const status = perEventStatus.get(p.kegiatanId) ?? nolStatus()
    status[p.status] += 1
    perEventStatus.set(p.kegiatanId, status)

    const kunci = bulanJakarta(p.terdaftarPada)
    const bulan = perBulan.get(kunci) ?? new Map<string, number>()
    bulan.set(p.kegiatanId, (bulan.get(p.kegiatanId) ?? 0) + 1)
    perBulan.set(kunci, bulan)
  }

  const perEventItem = new Map<string, { materi: number, galeri: number, referensi: number }>()
  for (const r of itemRows) {
    const isi = perEventItem.get(r.kegiatanId) ?? { materi: 0, galeri: 0, referensi: 0 }
    isi[r.bagian as keyof typeof isi] = r.jumlah
    perEventItem.set(r.kegiatanId, isi)
  }

  const perEventSesi = new Map(sesiRows.map(r => [r.kegiatanId, r.jumlah]))

  const daftarEvent = kegiatanRows.map((k) => {
    const status = perEventStatus.get(k.id) ?? nolStatus()
    const isi = perEventItem.get(k.id) ?? { materi: 0, galeri: 0, referensi: 0 }
    // `batal` tidak dihitung sebagai kursi terpakai: orangnya memang tidak jadi
    // ikut, dan memasukkannya membuat event terlihat penuh padahal tempatnya kosong.
    const terpakai = status.baru + status.proses + status.konfirmasi

    return {
      id: k.id,
      judul: k.judul,
      slug: k.slug,
      fase: faseKegiatan(k, sekarang),
      status: k.status,
      tanggalMulai: k.tanggalMulai,
      kuota: k.kuota,
      total: terpakai + status.batal,
      terpakai,
      ...status,
      sesi: perEventSesi.get(k.id) ?? 0,
      ...isi,
    }
  })

  const judulEvent = new Map(daftarEvent.map(e => [e.id, e.judul]))

  const bulan = rangkaBulan(sekarang).map((kunci) => {
    const isi = perBulan.get(kunci) ?? new Map<string, number>()
    return {
      kunci,
      label: labelBulan(kunci),
      total: [...isi.values()].reduce((n, v) => n + v, 0),
      // Rincian pembentuk titik ini — dipakai panel detail saat titiknya diklik.
      perEvent: [...isi.entries()]
        .map(([id, n]) => ({ id, judul: judulEvent.get(id) ?? '(event terhapus)', jumlah: n }))
        .sort((a, b) => b.jumlah - a.jumlah),
    }
  })

  const perFase = FASE.map(f => ({
    fase: f,
    jumlah: daftarEvent.filter(e => e.fase === f).length,
    event: daftarEvent.filter(e => e.fase === f).map(e => ({ id: e.id, judul: e.judul, total: e.total })),
  }))

  const kapasitas = daftarEvent.reduce((n, e) => n + (e.kuota ?? 0), 0)
  const terpakaiBerkuota = daftarEvent.reduce((n, e) => n + (e.kuota ? e.terpakai : 0), 0)

  // ── Kunjungan per bulan ────────────────────────────────────────────────────
  const kunjunganPerBulan = new Map<string, number>()
  for (const k of kunjunganRows) {
    // `tanggal` sudah disimpan dalam waktu Jakarta, jadi bulannya cukup dipotong
    // dari teksnya — tidak boleh lewat `new Date()`, yang akan menafsirkannya
    // sebagai UTC lalu menggeser hari terakhir tiap bulan ke bulan sebelumnya.
    const bulanKunci = k.tanggal.slice(0, 7)
    kunjunganPerBulan.set(bulanKunci, (kunjunganPerBulan.get(bulanKunci) ?? 0) + k.jumlah)
  }

  const orangPerBulan = new Map<string, number>()
  for (const p of pengunjungRows) {
    const bulanKunci = p.tanggal.slice(0, 7)
    orangPerBulan.set(bulanKunci, (orangPerBulan.get(bulanKunci) ?? 0) + p.jumlah)
  }

  const kunjungan = rangkaBulan(sekarang).map(kunci => ({
    kunci,
    label: labelBulan(kunci),
    total: kunjunganPerBulan.get(kunci) ?? 0,
    orang: orangPerBulan.get(kunci) ?? 0,
  }))

  // ── Orang yang mengikuti event ─────────────────────────────────────────────
  //
  // Dihitung per ORANG, bukan per pendaftaran: satu orang yang ikut tiga event
  // adalah satu orang. Dibedakan lewat email — `cc_peserta` menyimpan email
  // sebagai snapshot dan boleh berdiri tanpa akun, jadi itu satu-satunya penanda
  // yang selalu ada. Yang `batal` tidak dihitung: ia tidak jadi ikut.
  const ikut = pesertaRows.filter(p => p.status !== 'batal')
  const orangUnik = new Set(ikut.map(p => p.email?.toLowerCase()).filter(Boolean))
  const orangKonfirmasi = new Set(
    pesertaRows.filter(p => p.status === 'konfirmasi').map(p => p.email?.toLowerCase()).filter(Boolean),
  )

  // ── Event per bulan / minggu / tahun ───────────────────────────────────────
  //
  // Dikelompokkan menurut TANGGAL MULAI acaranya, bukan tanggal barisnya dibuat:
  // yang ditanyakan "berapa event bulan ini", dan itu soal kapan acaranya
  // berlangsung.
  const ringkasEvent = (e: typeof daftarEvent[number]) => ({
    id: e.id, judul: e.judul, jumlah: e.total,
  })

  const eventPer = {
    bulan: kelompokkan(daftarEvent, e => bulanJakarta(e.tanggalMulai), labelBulan)
      .map(g => ({ ...g, isi: g.isi.map(ringkasEvent) })),
    minggu: kelompokkan(daftarEvent, e => mingguIso(e.tanggalMulai), k => `Minggu ${k.split('-W')[1]} ${k.slice(0, 4)}`)
      .map(g => ({ ...g, isi: g.isi.map(ringkasEvent) })),
    tahun: kelompokkan(daftarEvent, e => hariJakarta(e.tanggalMulai).slice(0, 4), k => k)
      .map(g => ({ ...g, isi: g.isi.map(ringkasEvent) })),
  }

  // ── Jurnal ─────────────────────────────────────────────────────────────────
  // Masih daftar tetap di `shared/jurnal.ts`, bukan tabel; dibaca dari sana supaya
  // angkanya tidak pernah berbeda dari daftar di /admin/jurnal.
  const jurnal = {
    total: JURNAL.length,
    terbit: JURNAL.filter(j => j.status === 'Published').length,
    draft: JURNAL.filter(j => j.status === 'Draft').length,
    perBulan: kelompokkan(JURNAL, j => j.date.slice(0, 7), labelBulan)
      .map(g => ({ ...g, isi: g.isi.map(j => ({ id: j.id, judul: j.title, status: j.status })) })),
    daftar: JURNAL.map(j => ({ id: j.id, judul: j.title, status: j.status, tipe: j.type })),
  }

  // ── Berkas ─────────────────────────────────────────────────────────────────
  const berkas = (kind: 'video' | 'etc' | 'gambar') => {
    const milik = mediaRows.filter(m => m.kind === kind)
    return {
      jumlah: milik.length,
      bytes: milik.reduce((n, m) => n + m.bytes, 0),
      daftar: milik.map(m => ({
        id: m.id, nama: m.nama, mime: m.mime, bytes: m.bytes, url: m.url,
      })),
    }
  }

  // ── Member ─────────────────────────────────────────────────────────────────
  // Master disaring, mengikuti aturan yang sama dengan /admin/members: akun itu
  // tidak muncul di daftar mana pun, jadi menghitungnya di sini akan membuat angka
  // dashboard tidak pernah cocok dengan jumlah baris yang bisa dilihat orang.
  const [{ jumlah: memberAktif } = { jumlah: 0 }] = await db
    .select({ jumlah })
    .from(ccUser)
    .where(sql`${ne(ccUser.role, 'master')} and ${ccUser.isActive} = 1`)

  const member = {
    total: userRows.filter(r => r.role !== 'master').reduce((n, r) => n + r.jumlah, 0),
    aktif: memberAktif,
  }

  return {
    diperbarui: sekarang.toISOString(),
    ringkas: {
      event: daftarEvent.length,
      pendaftar: pesertaRows.length,
      konfirmasi: pesertaRows.filter(p => p.status === 'konfirmasi').length,
      belumDiproses: pesertaRows.filter(p => p.status === 'baru').length,
      kapasitas,
      terpakaiBerkuota,
      // Dibulatkan di server supaya angka yang sama tidak dibulatkan dua cara
      // berbeda di kartu dan di grafik.
      isiPersen: kapasitas ? Math.round((terpakaiBerkuota / kapasitas) * 100) : 0,
      media: mediaRows.length,
      mediaBytes: mediaRows.reduce((n, r) => n + r.bytes, 0),
      akun: userRows.reduce((n, r) => n + r.jumlah, 0),
      // Dua angka yang berbeda artinya, dan keduanya dipakai di layar:
      // `kunjungan*` = berapa kali halaman dibuka, `orang*` = berapa orang.
      // Satu orang yang datang tiga hari terhitung tiga pada `orangTotal` —
      // yang dijumlahkan adalah orang per hari.
      kunjunganTotal: kunjunganRows.reduce((n, r) => n + r.jumlah, 0),
      orangTotal: pengunjungRows.reduce((n, r) => n + r.jumlah, 0),
      orangHariIni: pengunjungRows.find(r => r.tanggal === hariJakarta(sekarang))?.jumlah ?? 0,
      kunjunganSejak: kunjunganRows.length
        ? kunjunganRows.map(r => r.tanggal).sort()[0]
        : null,
      ikutEvent: orangUnik.size,
      ikutEventKonfirmasi: orangKonfirmasi.size,
      pendaftaranIkut: ikut.length,
    },
    event: daftarEvent,
    bulan,
    perFase,
    kunjungan,
    eventPer,
    jurnal,
    member,
    video: berkas('video'),
    dokumen: berkas('etc'),
    gambar: berkas('gambar'),
    akun: bolehLihatRole
      ? USER_ROLES.map(role => ({
          role,
          label: ROLE_LABELS[role],
          level: ROLE_LEVELS[role],
          jumlah: userRows.find(r => r.role === role)?.jumlah ?? 0,
        }))
      : [],
  }
})
