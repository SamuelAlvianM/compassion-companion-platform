// server/db/seed-jurnal.ts
// Pemindahan sekali jalan: enam jurnal yang selama ini berupa array statis di
// `pages/jurnal.vue` + `shared/jurnal.ts`, dan tiga badan tulisan yang selama ini
// berupa halaman .vue tersendiri.
//
// Dijalankan: npx tsx --env-file-if-exists=.env server/db/seed-jurnal.ts
//
// Aman diulang: baris yang slug-nya sudah ada dilewati, bukan ditimpa. Menjalankan
// dua kali tidak menggandakan apa pun, dan tidak menghapus suntingan yang sudah
// dikerjakan lewat dashboard sesudah pemindahan ini.
//
// Tiga dari tujuh tulisan punya badan artikel sungguhan (dulu halaman .vue). Empat
// sisanya hanya pernah punya kutipan pembuka — kutipan itu dipakai apa adanya
// sebagai isi, dan itu memang seluruh teks yang pernah ada. Tidak ada yang dikarang
// di sini.

import { eq } from 'drizzle-orm'
import { db } from './index'
import { ccJurnal, ccKegiatan, type JurnalStatus, type JurnalTipe } from './schema'
import { slugify } from '../utils/randomId'

interface Benih {
  judul: string
  tipe: JurnalTipe
  status: JurnalStatus
  kontributor: string
  kontributorPeran: string | null
  /** Judul event yang direfleksikan; dicocokkan ke cc_kegiatan saat menanam. */
  event?: string
  tanggal: string
  ringkasan: string
  isi: string | null
}

const BENIH: Benih[] = [
  {
    judul: 'Menemukan Arah dalam Kebersamaan',
    tipe: 'sharing-journey',
    status: 'published',
    kontributor: 'Imanuel Ananta',
    kontributorPeran: 'Mahasiswa dan pegiat komunitas muda',
    tanggal: '2026-05-12',
    ringkasan: 'Ada masa ketika pertanyaan siapa saya terasa sederhana, tetapi jawabannya justru membawa saya pada perjalanan yang panjang. Di dalam kebersamaan, saya perlahan belajar mengenali arah.',
    isi: `<p>Ada masa ketika pertanyaan &ldquo;siapa saya?&rdquo; terasa sederhana, tetapi jawabannya justru membawa kita pada perjalanan yang panjang.</p>
<p>Dalam sebuah rekoleksi, seorang peserta muda menemukan bahwa mengenal diri bukanlah proses yang dilakukan sendirian. Melalui sesi refleksi, kerja kelompok, dan percakapan jujur, ia belajar memberi ruang bagi pertanyaan yang selama ini disimpan: untuk apa saya hadir, dan bagaimana saya dapat berarti bagi sesama?</p>
<h2>Belajar untuk percaya</h2>
<p>Kegiatan bersama membuka pengalaman baru. Kerja sama mengajarkan bahwa tidak semua persoalan harus dipikul seorang diri; meminta bantuan dan memberi kepercayaan dapat menjadi wujud keberanian. Kebersamaan bukan sekadar hadir di tempat yang sama, melainkan kesediaan untuk saling menopang.</p>
<blockquote><p>Kita bertumbuh ketika berani mengenal diri, membuka hati, dan melangkah bersama.</p></blockquote>
<h2>Panggilan yang menjadi nyata</h2>
<p>Dari hening, doa, dan refleksi, muncul kesadaran sederhana: hidup menemukan arah ketika dipakai untuk melayani. Kesadaran ini tidak menghapus semua keraguan, tetapi memberi langkah pertama yang lebih jernih untuk membawa kasih, persaudaraan, dan kepemimpinan ke dalam keseharian.</p>`,
  },
  {
    judul: 'Ketika Saya Belajar Mendengarkan',
    tipe: 'event-reflection',
    status: 'published',
    kontributor: 'Nicholas',
    kontributorPeran: 'Peserta Listening as Leadership dan pegiat komunitas muda',
    event: 'Listening as Leadership',
    tanggal: '2026-05-01',
    ringkasan: 'Saya selalu mengira pemimpin harus paling cepat memberi jawaban. Ternyata, terkadang yang dibutuhkan adalah kehadiran yang sungguh mendengarkan.',
    isi: `<p>Saya datang dengan keyakinan bahwa seorang pemimpin harus selalu tahu apa yang harus dikatakan.</p>
<p>Dalam sesi mendengarkan, kami diminta duduk berpasangan dan tidak terburu-buru memberi saran. Saya ingin menawarkan jalan keluar, tetapi teman saya hanya meminta ruang untuk bercerita.</p>
<h2>Hadir sebelum memberi jawaban</h2>
<p>Saya mulai memahami bahwa mendengarkan bukan sikap pasif. Ia membutuhkan perhatian, kesabaran, dan keberanian untuk tidak menjadikan pengalaman orang lain sebagai masalah yang harus segera saya selesaikan.</p>
<blockquote><p>Terkadang, kehadiran yang sungguh mendengarkan adalah bentuk kepemimpinan yang paling lembut.</p></blockquote>
<p>Sejak saat itu, saya ingin membawa cara hadir ini ke dalam keluarga, pekerjaan, dan komunitas saya.</p>`,
  },
  {
    judul: 'Membawa Kegelisahan kepada Tuhan',
    tipe: 'event-reflection',
    status: 'published',
    kontributor: 'Anna',
    kontributorPeran: 'Peserta Leadership with Compassion',
    event: 'Leadership with Compassion',
    tanggal: '2026-04-20',
    ringkasan: 'Dari kegelisahan itu saya belajar melihat keadaan hati saya dengan jujur dan penuh belas kasih. Saya tidak perlu segera menyelesaikan semuanya sendiri.',
    isi: `<p>Hari itu saya sulit berkonsentrasi. Pikiran saya terus kembali ke pekerjaan yang belum selesai.</p>
<p>Pada awalnya saya kesal karena merasa tidak mampu mengikuti doa dengan baik. Namun saya menyadari bahwa kegelisahan itu bukan gangguan yang harus saya singkirkan; ia adalah keadaan hati yang perlu saya bawa dengan jujur.</p>
<h2>Melihat dengan belas kasih</h2>
<p>Dalam keheningan, saya belajar tidak menghakimi diri sendiri. Saya dapat mengakui rasa lelah dan cemas, lalu menyerahkannya kepada Tuhan. Dari sana, saya mendapat ruang untuk bernapas dan kembali hadir bagi orang lain.</p>
<blockquote><p>Belas kasih dimulai ketika kita berani menerima keadaan hati sendiri.</p></blockquote>
<p>Pelayanan yang baik tidak harus dimulai dari hati yang sempurna, melainkan dari hati yang jujur dan terbuka.</p>`,
  },
  {
    judul: 'Kehadiran yang Membuka Ruang',
    tipe: 'insight',
    status: 'published',
    kontributor: 'Henk T. Sengkey',
    kontributorPeran: 'Leadership Coach',
    tanggal: '2026-04-08',
    ringkasan: 'Mendampingi tidak selalu berarti menawarkan jawaban. Kadang, yang paling dibutuhkan seseorang adalah ruang aman untuk melihat pengalamannya sendiri.',
    isi: '<p>Mendampingi tidak selalu berarti menawarkan jawaban. Kadang, yang paling dibutuhkan seseorang adalah ruang aman untuk melihat pengalamannya sendiri.</p>',
  },
  {
    judul: 'Tiga Menit untuk Mendengarkan Diri',
    tipe: 'practice',
    status: 'published',
    kontributor: 'Tim Compassionate Companion',
    kontributorPeran: 'Praktik mingguan',
    tanggal: '2026-03-28',
    ringkasan: 'Latihan sederhana ini dapat dilakukan sebelum rapat, pelayanan, atau percakapan penting: berhenti, bernapas, dan memberi nama pada keadaan hati.',
    isi: '<p>Latihan sederhana ini dapat dilakukan sebelum rapat, pelayanan, atau percakapan penting: berhenti, bernapas, dan memberi nama pada keadaan hati.</p>',
  },
  {
    judul: 'Berani Hadir dalam Percakapan Sulit',
    tipe: 'event-reflection',
    status: 'published',
    kontributor: 'Maria',
    kontributorPeran: 'Peserta program',
    event: 'Listening as Leadership',
    tanggal: '2026-03-15',
    ringkasan: 'Saya belajar bahwa keberanian bukan soal bicara paling keras, melainkan bertahan hadir ketika percakapan mulai terasa tidak nyaman.',
    isi: '<p>Saya belajar bahwa keberanian bukan soal bicara paling keras, melainkan bertahan hadir ketika percakapan mulai terasa tidak nyaman.</p>',
  },
  {
    // Satu-satunya yang bukan berasal dari halaman publik: ia sudah berstatus Draft
    // di daftar admin statis, dan masuk ke sini sebagai draft juga — tanpa isi,
    // karena isinya memang belum pernah ditulis.
    judul: 'Tips Mendampingi Lansia yang Susah Diatur',
    tipe: 'practice',
    status: 'draft',
    kontributor: 'Maria',
    kontributorPeran: null,
    tanggal: '2026-03-21',
    ringkasan: '',
    isi: null,
  },
]

const tanam = () => {
  let dibuat = 0
  let dilewati = 0

  for (const b of BENIH) {
    const slug = slugify(b.judul)
    const ada = db.select({ id: ccJurnal.id }).from(ccJurnal).where(eq(ccJurnal.slug, slug)).get()
    if (ada) {
      console.log(`  = dilewati   ${slug}`)
      dilewati++
      continue
    }

    // Event dicocokkan dari judulnya. Kalau eventnya tidak ada di database ini,
    // jurnalnya tetap masuk tanpa tautan — kehilangan satu tautan jauh lebih baik
    // daripada kehilangan tulisannya.
    const kegiatan = b.event
      ? db.select({ id: ccKegiatan.id }).from(ccKegiatan).where(eq(ccKegiatan.judul, b.event)).get()
      : null

    if (b.event && !kegiatan) console.log(`  ! event "${b.event}" tidak ditemukan — tautan dikosongkan`)

    const tanggal = new Date(`${b.tanggal}T00:00:00+07:00`)

    db.insert(ccJurnal).values({
      slug,
      judul: b.judul,
      ringkasan: b.ringkasan || null,
      isi: b.isi,
      tipe: b.tipe,
      status: b.status,
      kontributor: b.kontributor,
      kontributorPeran: b.kontributorPeran,
      kegiatanId: kegiatan?.id ?? null,
      // Tanggal aslinya dipertahankan sebagai tanggal terbit — kalau memakai
      // "sekarang", enam tulisan lama akan muncul serentak sebagai yang terbaru.
      diterbitkanPada: b.status === 'published' ? tanggal : null,
      createdAt: tanggal,
      updatedAt: tanggal,
    }).run()

    console.log(`  + dibuat     ${slug}  [${b.status}]`)
    dibuat++
  }

  console.log(`\nSelesai: ${dibuat} dibuat, ${dilewati} dilewati.`)
}

tanam()
