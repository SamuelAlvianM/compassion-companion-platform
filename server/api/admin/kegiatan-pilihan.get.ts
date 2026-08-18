// server/api/admin/kegiatan-pilihan.get.ts
// Daftar event untuk kotak "Event terkait" di halaman sunting jurnal.
//
// Endpoint kecil sendiri, bukan memakai /api/admin/events — pola yang sama dengan
// editors.get.ts, dan alasannya juga sama. Daftar admin membawa hitungan peserta,
// sesi, dan materi tiap kegiatan (tiga query tambahan) supaya tabelnya bisa
// menampilkan penanda; sebuah dropdown cuma perlu id dan judulnya.
//
// Editor ikut boleh membacanya: ia menyunting jurnal yang ditugaskan kepadanya,
// dan tautan ke event bagian dari tulisan itu.

import { desc } from 'drizzle-orm'
import { db } from '../../db'
import { ccKegiatan } from '../../db/schema'
import { faseKegiatan } from '../../utils/kegiatan'
import { wajibRole } from '../../utils/session'

/**
 * Berapa lama sesudah sebuah event berakhir ia masih boleh dipilih.
 *
 * Refleksi ditulis selagi kejadiannya masih hangat. Event yang sudah lewat
 * setahun praktis tidak akan pernah jadi bahan tulisan baru, dan membiarkannya di
 * dropdown berarti daftar itu tumbuh selamanya — tiap tahun makin panjang, dan
 * yang benar-benar dicari makin dalam terkubur.
 *
 * Angkanya di sini, satu tempat. Kalau nanti terasa terlalu pendek (mis. ada
 * program yang refleksinya baru terkumpul dua bulan sesudahnya), ganti angka ini
 * saja — tidak ada tempat kedua yang menyimpan asumsi yang sama.
 */
const HARI_MASIH_RELEVAN = 30

const HARI = 24 * 60 * 60 * 1000

export default defineEventHandler(async (event) => {
  await wajibRole(event, 'editor')

  // Catatan penting soal batas ini: ia menyaring apa yang bisa DIPILIH, bukan apa
  // yang sudah terpilih. Jurnal lama yang menunjuk event dari setahun lalu tetap
  // menggambarkan eventnya di layar sunting — halamannya menyisipkan sendiri baris
  // itu dari judul yang dikirim endpoint detail (`kegiatanTerpasang`). Kalau tidak,
  // membuka jurnal lama akan menampilkan kotak yang tampak kosong, dan simpanan
  // berikutnya diam-diam memutus tautan yang sudah benar.
  const rows = db
    .select({
      id: ccKegiatan.id,
      judul: ccKegiatan.judul,
      status: ccKegiatan.status,
      tanggalMulai: ccKegiatan.tanggalMulai,
      tanggalSelesai: ccKegiatan.tanggalSelesai,
    })
    .from(ccKegiatan)
    // Terbaru di atas. Refleksi hampir selalu ditulis tentang event yang baru
    // lewat, jadi yang dicari orang biasanya ada di beberapa baris pertama —
    // mengurutkannya menurut abjad berarti menggulir untuk kasus yang paling sering.
    .orderBy(desc(ccKegiatan.tanggalMulai))
    .all()

  const sekarang = Date.now()

  const dipakai = rows.filter((row) => {
    const fase = faseKegiatan(row)

    // Yang belum terjadi tidak bisa direfleksikan. Ini penyaring yang paling
    // banyak membersihkan daftar, dan yang paling jelas alasannya.
    if (fase === 'mendatang') return false
    // Yang dibatalkan tidak pernah terjadi sama sekali.
    if (fase === 'batal') return false
    if (fase === 'berlangsung') return true

    // Sisanya `selesai`: dibatasi umurnya. Patokannya tanggal berakhirnya —
    // untuk event sehari, tanggalSelesai kosong dan tanggalMulai yang dipakai.
    const berakhir = (row.tanggalSelesai ?? row.tanggalMulai).getTime()
    return sekarang - berakhir <= HARI_MASIH_RELEVAN * HARI
  })

  // Tahun ikut ditulis di labelnya. Sebuah program berulang tiap tahun dengan
  // judul yang sama persis, dan dropdown berisi tiga baris identik memaksa orang
  // menebak mana yang dimaksud.
  return {
    data: dipakai.map(row => ({
      id: row.id,
      judul: row.judul,
      fase: faseKegiatan(row),
      label: `${row.judul} (${new Date(row.tanggalMulai).getFullYear()})`,
    })),
    meta: { hariMasihRelevan: HARI_MASIH_RELEVAN },
  }
})
