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

  // Dua fase yang boleh dipilih: yang sedang BERLANGSUNG dan yang sudah SELESAI.
  //
  // Sebelumnya yang selesai dibatasi umurnya — 30 hari sejak berakhir — dengan
  // alasan refleksi ditulis selagi kejadiannya masih hangat. Alasan itu benar untuk
  // sebagian tulisan tapi salah sebagai aturan: dokumentasi acara lama memang baru
  // masuk berbulan-bulan kemudian, dan saat itu terjadi, eventnya sudah tidak ada
  // di daftar dan tidak ada apa pun di layar yang menjelaskan kenapa.
  //
  // Konsekuensinya daftar ini tumbuh seiring waktu. Yang menahannya: urutan terbaru
  // di atas, dan tahun yang ikut ditulis di tiap label.
  const dipakai = rows.filter((row) => {
    const fase = faseKegiatan(row)
    // Yang belum terjadi tidak bisa direfleksikan; yang dibatalkan tidak pernah
    // terjadi sama sekali.
    return fase === 'berlangsung' || fase === 'selesai'
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
  }
})
