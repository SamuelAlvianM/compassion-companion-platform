<script setup lang="ts">
// Form event admin: identitas event + pengelola sesi & materi.
//
// Satu halaman menangani "baru" dan "ubah", dan keduanya berbentuk sama: ketiga tab
// ada di dua-duanya, dan tab Materi bisa dipakai penuh di dua-duanya.
//
// Yang membedakan KAPAN sesuatu tersimpan:
//
// - ubah  — tidak ada tombol simpan sama sekali. Identitas event menyimpan diri
//           800 ms sesudah pengetikan berhenti; sesi, materi, dan galeri menyimpan
//           diri seketika lewat endpointnya masing-masing.
// - baru  — tidak ada yang tersimpan sampai "Buat event" ditekan, tab mana pun.
//           Sesi & materi disusun sebagai draf di memori halaman (lihat blok
//           "Draf sesi"), lalu ditulis seluruhnya oleh `buatEvent()`.
//
// Berkas adalah satu-satunya pengecualian, dan itu tidak bisa dihindari: `mediaId`
// hanya lahir dari unggahan, jadi berkas naik saat dipilih. Kalau event batal
// dibuat, yang tertinggal berkas tanpa pemakai — bukan event setengah jadi.
//
// Ketiga tab punya drafnya sendiri, peserta termasuk: sebagian orang membooking
// lewat WhatsApp atau di tempat, dan menyuruh mereka mendaftar ulang lewat halaman
// publik berarti mengulang pekerjaan yang sudah selesai. Endpointnya baru —
// POST /api/admin/events/[id]/peserta.
definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()
const id = computed(() => String(route.params.id))
const baru = computed(() => id.value === 'new')

// Harga dan status sengaja tidak ada di sini.
//
// Harga: event komunitas ini tidak menagih lewat situs — pembayaran diurus admin
// lewat WhatsApp — jadi angka di formulir hanya menuntut diisi tanpa menentukan
// apa pun. Kolomnya masih ada di database (default 0) untuk transaksi yang dicatat
// terpisah.
//
// Status: fase kini murni turunan tanggal (server/utils/kegiatan.ts), jadi
// "mendatang / berlangsung / selesai" tidak lagi bisa berselisih dengan
// kalendernya. Server memasang `terbit` untuk setiap kegiatan yang disimpan dari
// sini — lihat catatan di bacaKegiatan().
const kosong = () => ({
  judul: '', judulEn: '', deskripsi: '', deskripsiEn: '',
  lokasi: '', tautanDaring: '',
  tanggalMulai: '', tanggalSelesai: '',
  jamMulai: '', jamSelesai: '',
  tutupTanggal: '', tutupJam: '23:55',
  // Selalu string, meski isinya angka: `<UInput>` hanya menerima string, dan
  // validasi-event.ts sudah menerima kuota dalam bentuk teks maupun angka.
  kuota: '',
  coverMediaId: '',
  thumbnailMediaId: '',
})

const form = ref(kosong())
const sesi = ref<any[]>([])

/**
 * Peserta yang dimasukkan tangan admin sebelum eventnya ada — yang membooking
 * lewat WhatsApp, panitia, atau di tempat.
 *
 * Hanya dipakai mode `baru`. Pada event tersimpan, AdminPesertaTab mengurus
 * daftarnya sendiri langsung ke server; tidak ada gunanya menyalinnya ke sini.
 */
const pesertaDraf = ref<any[]>([])

/** Terbukanya modal "Tambah peserta". Tinggal di sini karena tombolnya duduk di
    kepala kartu, sementara formnya ada di dalam PesertaDraf. */
const pesertaModal = ref(false)
const galat = ref('')
const sibuk = ref(false)
const toast = useToast()

/** Alamat gambar yang sedang terpasang — untuk pratinjau, bukan untuk disimpan. */
const gambar = ref<string | null>(null)

/**
 * Status redaksional event yang tersimpan di server.
 *
 * DI LUAR `form`, dan itu disengaja. `form` diawasi autosave; kalau status ikut di
 * dalamnya, membatalkan event akan tercampur ke dalam PATCH yang sama dengan
 * pengetikan judul, dan pembatalan bukan sesuatu yang boleh terjadi sebagai efek
 * samping mengetik. Ia diubah hanya lewat tombolnya sendiri, sekali kirim.
 */
const statusEvent = ref<string>('terbit')
const dibatalkan = computed(() => statusEvent.value === 'batal')

/**
 * Sidik isian yang terakhir diketahui sudah tersimpan.
 *
 * Autosave membandingkan diri dengan ini sebelum mengirim apa pun. Tanpanya,
 * `muat()` — yang mengganti seluruh `form` dengan isi dari server — akan terbaca
 * oleh pengamat sebagai perubahan, lalu menuliskan balik persis apa yang barusan
 * dibaca. Menambah sesi pun akan memicu satu PATCH kegiatan yang tidak diminta
 * siapa pun.
 */
const tersimpan = ref('')

/**
 * Kolom yang ikut menentukan "sudah berubah atau belum".
 *
 * Berdiri di sini, di atas `muat()`, bukan di dekat autosave di bawah: `muat()`
 * memanggil `sidik()` untuk mencatat keadaan awal, dan ia berjalan lebih dulu
 * daripada seluruh baris di bawahnya. `const` yang dideklarasikan belakangan
 * masih dalam TDZ pada saat itu — "Cannot access 'KUNCI' before initialization",
 * dan halamannya mati dengan 500 sebelum sempat tergambar.
 */
const KUNCI = ['judul', 'judulEn', 'deskripsi', 'deskripsiEn', 'lokasi', 'tautanDaring',
  'tanggalMulai', 'tanggalSelesai', 'jamMulai', 'jamSelesai', 'tutupTanggal', 'tutupJam',
  'kuota', 'coverMediaId', 'thumbnailMediaId'] as const

const sidik = () => JSON.stringify(KUNCI.map(k => form.value[k]))

// Timestamp dari API → 'YYYY-MM-DD', dibaca dalam WIB supaya tanggalnya tidak
// mundur sehari (bug yang sama pernah muncul di halaman event publik).
const keYmd = (nilai: string | null) => {
  if (!nilai) return ''
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Jakarta',
  }).format(new Date(nilai))
}

/** Timestamp → `HH:MM` WIB, dibulatkan ke bawah ke kelipatan 5 menit supaya nilai
    lama tetap bisa diperlihatkan kembali oleh WaktuPicker. */
const keJamWib = (nilai: string | null) => {
  if (!nilai) return ''
  const [h, m] = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta',
  }).format(new Date(nilai)).split(':')
  return `${h}:${String(Math.floor(Number(m) / 5) * 5).padStart(2, '0')}`
}

const muat = async () => {
  if (baru.value) {
    form.value = kosong()
    sesi.value = []
    gambar.value = null
    statusEvent.value = 'terbit'
    return
  }
  // Saat SSR, $fetch tidak ikut membawa cookie browser — tanpa penerusan ini,
  // endpoint admin selalu menjawab 401 pada render pertama.
  const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
  const res = await $fetch<any>(`/api/admin/events/${id.value}`, { headers })
  const d = res.data
  form.value = {
    judul: d.judul ?? '', judulEn: d.judulEn ?? '',
    deskripsi: d.deskripsi ?? '', deskripsiEn: d.deskripsiEn ?? '',
    lokasi: d.lokasi ?? '', tautanDaring: d.tautanDaring ?? '',
    tanggalMulai: keYmd(d.tanggalMulai), tanggalSelesai: keYmd(d.tanggalSelesai),
    jamMulai: d.jamMulai ?? '', jamSelesai: d.jamSelesai ?? '',
    tutupTanggal: keYmd(d.tutupPendaftaran),
    tutupJam: keJamWib(d.tutupPendaftaran) || '23:55',
    kuota: d.kuota == null ? '' : String(d.kuota),
    coverMediaId: d.coverMediaId ?? '',
    thumbnailMediaId: d.thumbnailMediaId ?? '',
  }
  // Event lama bisa punya salah satunya saja; yang mana pun ada, itu yang tampil.
  gambar.value = d.cover ?? d.thumbnail ?? null
  statusEvent.value = d.status ?? 'terbit'
  sesi.value = res.sesi ?? []
  tersimpan.value = sidik()
}

await muat()
watch(id, muat)

const pesan = (e: any, bawaan: string) =>
  e?.data?.statusMessage ?? e?.statusMessage ?? bawaan

/** Event sehari — hanya di situ urutan jam bisa dibandingkan. Pada event
    berhari-hari, "selesai 09.00" setelah "mulai 16.00" justru normal. */
const sehari = computed(() =>
  !form.value.tanggalSelesai || form.value.tanggalSelesai === form.value.tanggalMulai)

/**
 * Pemeriksaan yang bisa dijawab tanpa server, ditampilkan sebelum tombol simpan
 * ditekan. Server tetap memeriksa hal yang sama — ini kenyamanan, bukan penjagaan.
 */
const peringatan = computed(() => {
  if (form.value.tanggalSelesai && form.value.tanggalSelesai < form.value.tanggalMulai) {
    return 'Tanggal selesai tidak boleh mendahului tanggal mulai.'
  }
  if (sehari.value && form.value.jamMulai && form.value.jamSelesai
    && form.value.jamSelesai <= form.value.jamMulai) {
    return 'Jam selesai harus setelah jam mulai.'
  }
  // Batas pendaftaran sesudah acara mulai bukan batas apa pun. Dibandingkan
  // sebagai tanggal, bukan sebagai saat: batas "23.55 di hari acara" itu lazim.
  if (form.value.tutupTanggal && form.value.tanggalMulai
    && form.value.tutupTanggal > form.value.tanggalMulai) {
    return 'Batas akhir pendaftaran tidak boleh melewati tanggal mulai.'
  }
  return ''
})

/** `YYYY-MM-DD` digeser sekian hari. Lewat `Date.UTC` supaya tidak menyentuh zona
    waktu mesin — yang ditambah di sini hari kalender, bukan 24 jam. */
const geserYmd = (ymd: string, hari: number) => {
  const [y, b, t] = ymd.split('-').map(Number)
  const d = new Date(Date.UTC(y!, b! - 1, t! + hari))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

const selisihHari = (dari: string, ke: string) => {
  const [y1, b1, t1] = dari.split('-').map(Number)
  const [y2, b2, t2] = ke.split('-').map(Number)
  return Math.round((Date.UTC(y2!, b2! - 1, t2!) - Date.UTC(y1!, b1! - 1, t1!)) / 86_400_000)
}

/**
 * Tanggal selesai mengikuti tanggal mulai — tiga aturan, bukan satu.
 *
 * Versi sebelumnya hanya mengisi saat pertama kali (`if (sebelumnya) return`), dan
 * itu meninggalkan lubang yang paling gampang kena: pilih 4 Agu (selesai ikut jadi
 * 4 Agu), lalu betulkan tanggal mulai jadi 14 Agu — selesai tetap 4 Agu, dan
 * formulir berdiri dengan event yang berakhir sepuluh hari sebelum ia mulai.
 *
 * - Kosong → ikut. Kebanyakan event jatuh dalam satu hari.
 * - Sama dengan tanggal mulai yang LAMA → ikut terus. Itu event sehari; selesainya
 *   tidak pernah dipilih sendiri, ia cuma cerminan tanggal mulai.
 * - Sudah dipilih sendiri, tapi tanggal mulai baru melewatinya → DIGESER sejauh
 *   yang sama, bukan disamakan. Event tiga hari yang tanggalnya dimajukan tetap
 *   tiga hari; memotongnya jadi sehari tidak akan terlihat sampai kartunya terbit.
 *
 * Di luar ketiganya tangan yang mengetik yang menentukan: 12–15 lalu mulainya
 * dibetulkan jadi 13 tetap berakhir 15.
 */
watch(() => form.value.tanggalMulai, (mulai, sebelumnya) => {
  if (!mulai) return
  const selesai = form.value.tanggalSelesai
  if (!selesai || selesai === sebelumnya) { form.value.tanggalSelesai = mulai; return }
  if (selesai < mulai && sebelumnya) form.value.tanggalSelesai = geserYmd(selesai, selisihHari(sebelumnya, mulai))
  else if (selesai < mulai) form.value.tanggalSelesai = mulai
})

// ── Gambar ───────────────────────────────────────────────────────────────────
// Yang disimpan `mediaId`; alamatnya cuma untuk pratinjau. Pada mode ubah,
// perubahan ini ikut terbaca pengamat autosave dan tersimpan sendiri 800 ms
// kemudian — tidak ada tombol tersendiri untuk gambar.
//
// SATU unggahan mengisi DUA kolom. Sebelumnya ada dua kotak — "Gambar utama" 16:9
// dan "Thumbnail" 4:3 — dengan alasan tiap bingkai layak dapat potongannya sendiri.
// Alasan itu benar secara tampilan tapi salah secara pemakaian: yang mengisi
// formulir punya satu foto per event, lalu harus mengunggah dan memotong foto yang
// sama dua kali, dan kotak kedua yang boleh kosong membuat sebagian event punya
// thumbnail sementara sisanya tidak — tanpa ada yang sengaja memutuskan begitu.
//
// Kolom `thumbnailMediaId` sengaja TIDAK dihapus dari skema. Ia tetap diisi, cuma
// dengan media yang sama, sehingga seluruh pembaca di sisi tampilan (kartu daftar
// event, halaman detail, API publik) tidak perlu diubah satu pun — dan kalau kelak
// potongan terpisah diinginkan lagi, tempatnya masih ada.
const pasangGambar = (hasil: { mediaId: string, url: string }) => {
  form.value.coverMediaId = hasil.mediaId
  form.value.thumbnailMediaId = hasil.mediaId
  gambar.value = hasil.url
}

const lepasGambar = () => {
  form.value.coverMediaId = ''
  form.value.thumbnailMediaId = ''
  gambar.value = null
}

// ── Pembatalan event ─────────────────────────────────────────────────────────
//
// Sampai sekarang kolom `status` menyimpan 'batal' dan `faseKegiatan()` menghormatinya
// di atas perhitungan tanggal, tapi tidak ada satu pun formulir yang memasangnya —
// sisa dari saat kolom status dicabut dari layar. Akibatnya penyaring "Dibatalkan"
// di daftar event menawarkan pembedaan yang tidak bisa dibuat siapa pun.
//
// Tombolnya dibuat DUA ARAH. Satu tombol yang hanya bisa membatalkan berarti salah
// tekan sekali membuat event tidak bisa dikembalikan dari layar mana pun — dan
// pembatalan justru tindakan yang paling mungkin ditekan karena keliru membaca.
const konfirmasiBatal = ref(false)
const memprosesStatus = ref(false)

const ubahStatusEvent = async (status: 'batal' | 'terbit') => {
  memprosesStatus.value = true
  galat.value = ''
  try {
    await $fetch(`/api/admin/events/${id.value}`, { method: 'PATCH', body: { status } })
    statusEvent.value = status
    konfirmasiBatal.value = false
    toast.add({
      title: status === 'batal' ? 'Event dibatalkan' : 'Event dipulihkan',
      description: status === 'batal'
        ? 'Halaman event kini ditandai dibatalkan dan pendaftaran ditutup.'
        : 'Fase event kembali dihitung dari tanggal acara.',
      color: status === 'batal' ? 'warning' : 'success',
    })
  }
  catch (e: any) {
    galat.value = pesan(e, 'Gagal mengubah status event.')
  }
  finally {
    memprosesStatus.value = false
  }
}

/** Body yang dikirim ke API: dua kotak batas pendaftaran dilebur jadi satu nilai,
    dan kolom bantu (`tutupTanggal`, `tutupJam`) tidak ikut terkirim. */
const payload = () => {
  const { tutupTanggal, tutupJam, ...sisa } = form.value
  return {
    ...sisa,
    // Jam tanpa tanggal bukan batas apa pun, jadi tanggal yang menentukan ada
    // tidaknya nilai ini.
    tutupPendaftaran: tutupTanggal ? `${tutupTanggal}T${tutupJam || '23:55'}` : null,
  }
}

// Diikat ke variabel lokal supaya bisa dipanggil dari template: auto-import Nuxt
// bekerja pada blok script, dan yang hanya muncul di template tidak ikut terbawa.
const wajibKosong = belumDiisi

/**
 * "Buat event" sudah pernah ditekan.
 *
 * Penanda kolom wajib menyala dari sini, bukan sejak formulir dibuka: formulir
 * event baru selalu kosong pada detik pertama, dan tiga kolom merah yang menyambut
 * orang sebelum ia sempat mengetik apa pun bukan peringatan — itu cuma latar.
 */
const dicoba = ref(false)

/** Kolom wajib yang masih kosong — disebutkan namanya, bukan cuma "lengkapi dulu". */
const kurang = computed(() => {
  const daftar: string[] = []
  if (!form.value.judul.trim()) daftar.push('judul')
  if (!form.value.lokasi.trim()) daftar.push('lokasi')
  if (!form.value.tanggalMulai) daftar.push('tanggal mulai')
  if (!form.value.coverMediaId) daftar.push('gambar event')
  return daftar
})

/**
 * Syarat sebuah event boleh lahir.
 *
 * Judul, lokasi, dan tanggal mulai dituntut server (`bacaKegiatan()`). Gambar
 * TIDAK — ia aturan halaman ini, dan ditegakkan hanya saat membuat.
 *
 * Alasannya: setiap event tampil sebagai kartu di daftar event dan sebagai kepala
 * halaman detailnya. Event tanpa gambar tidak menghasilkan galat apa pun, ia cuma
 * menghasilkan kartu abu-abu di antara kartu-kartu bergambar — dan itu baru
 * ketahuan sesudah terbit, oleh orang yang bukan pembuatnya.
 *
 * Tidak ditegakkan pada mode ubah dengan sengaja: event lama yang belum punya
 * gambar akan membuat autosave menolak SETIAP perubahan, termasuk perbaikan salah
 * ketik yang tidak ada hubungannya dengan gambar.
 *
 * Daftar kolomnya dipinjam dari `kurang`, tidak ditulis ulang. Dua daftar kolom
 * wajib yang berdiri sendiri-sendiri hanya menunggu menyimpang, dan saat
 * menyimpang gejalanya tombol yang menolak tanpa menyebutkan kolom mana yang
 * kurang — atau, lebih buruk, menerima yang kurang. Karena itu ia berdiri SESUDAH
 * `kurang`, bukan sebelumnya.
 */
const bisaDilahirkan = computed(() => kurang.value.length === 0 && !peringatan.value)

/**
 * Alasan sebuah simpanan otomatis ditolak — kosong berarti boleh jalan.
 *
 * Dipisah dari `peringatan` karena keduanya menjawab pertanyaan yang berbeda.
 * `peringatan` = "isian ini saling bertentangan"; ini = "karena itu tidak ada yang
 * tersimpan". Yang kedua wajib terbaca; yang pertama boleh duduk di dekat isian
 * yang bersangkutan.
 *
 * Gambar ikut menghalangi, dan itu perubahan yang disengaja. Sebelumnya ia hanya
 * dituntut saat event LAHIR, dengan alasan bahwa event lama yang belum bergambar
 * akan kehilangan kemampuan menyunting apa pun. Alasan itu masih benar — bedanya,
 * sekarang penolakannya terbaca dan menyebutkan apa yang harus dikerjakan, bukan
 * membuat formulirnya tampak mogok. Event tanpa gambar tetap tampil sebagai kartu
 * abu-abu di antara kartu bergambar, dan itu baru ketahuan sesudah terbit, oleh
 * orang yang bukan pembuatnya.
 */
const penghalangSimpan = computed(() => {
  if (peringatan.value) return peringatan.value
  if (!form.value.coverMediaId) {
    return 'Gambar event wajib diisi. Unggah gambarnya di bagian “Gambar event” — sampai itu ada, perubahan lain belum bisa tersimpan.'
  }
  return ''
})

/**
 * "Buat event" — satu-satunya tombol simpan yang tersisa di halaman ini, dan pada
 * event baru ia menuliskan SELURUH isi formulir, bukan hanya tab pertamanya.
 *
 * Sampai tombol ini ditekan, tidak ada satu baris pun di database. Sesi dan materi
 * yang disusun di tab sebelah hidup sebagai draf di `sesi` (lihat blok "Draf sesi"),
 * dan di sini mereka ditulis berurutan: kegiatan dulu, lalu sesinya, lalu itemnya.
 *
 * Urutan POST itu bukan pilihan gaya — sesi butuh `kegiatanId` dan item butuh
 * `sesiId`, jadi tidak ada jalan menuliskannya serentak. Yang bisa dijaga cuma
 * urutan tampilnya: `urutan` di server dihitung dari MAX yang sudah ada, sehingga
 * mengirim item satu per satu sesuai urutan draf sudah cukup.
 *
 * Berkas adalah pengecualian yang jujur: ia sudah naik ke pustaka media saat
 * dipilih, karena `mediaId` hanya lahir dari unggahan. Kalau event batal dibuat,
 * yang tertinggal berkas tanpa pemakai di pustaka — bukan event setengah jadi.
 */
const buatEvent = async () => {
  // Ditekan lebih dulu, baru diperiksa: tombolnya sengaja tetap hidup saat isian
  // belum lengkap, karena tekanan inilah yang menyalakan penanda kolom wajib.
  dicoba.value = true
  if (!bisaDilahirkan.value) {
    galat.value = `Belum bisa dibuat — ${kurang.value.join(', ')} masih kosong.`
    tabAktif.value = 'info'
    return false
  }
  if (peringatan.value) { galat.value = peringatan.value; return false }
  const tanpaJudul = sesi.value.find(s => !String(s.judul ?? '').trim())
  if (tanpaJudul) {
    galat.value = 'Ada sesi yang judulnya masih kosong. Isi dulu di tab Materi.'
    tabAktif.value = 'materi'
    return false
  }

  sibuk.value = true
  galat.value = ''
  try {
    const res = await $fetch<any>('/api/admin/events', { method: 'POST', body: payload() })
    const kegiatanId = res.data.id
    // Server membekali tiap event baru dengan satu sesi. Sesi itu dipakai ulang
    // untuk draf pertama alih-alih dibuat lagi — kalau tidak, event yang drafnya
    // satu sesi akan lahir dengan dua, dan yang kedua kosong tanpa ada yang memintanya.
    const sesiBawaan: string | undefined = res.data.sesi?.[0]?.id

    const drafSesi = sesi.value
    for (const [i, s] of drafSesi.entries()) {
      let sesiId = i === 0 ? sesiBawaan : undefined
      if (!sesiId) {
        const dibuat = await $fetch<any>('/api/admin/sesi', {
          method: 'POST',
          body: { kegiatanId, judul: s.judul, judulEn: s.judulEn || null },
        })
        sesiId = dibuat.data.id
      }
      // Selalu PATCH, juga untuk sesi yang barusan dibuat: POST sesi tidak menerima
      // `tampil`, dan sesi yang sengaja disembunyikan akan terbit tanpa itu.
      await $fetch(`/api/admin/sesi/${sesiId}`, {
        method: 'PATCH',
        body: { judul: s.judul, judulEn: s.judulEn || null, tampil: s.tampil },
      })

      for (const bagian of ['materi', 'galeri', 'referensi'] as const) {
        for (const item of s[bagian] ?? []) {
          await $fetch('/api/admin/sesi-item', {
            method: 'POST',
            body: {
              sesiId,
              bagian,
              jenis: item.jenis,
              judul: item.judul,
              judulEn: item.judulEn || null,
              mediaId: item.mediaId || null,
              url: item.url || null,
              terkunci: item.terkunci,
            },
          })
        }
      }
    }

    // Draf yang seluruh sesinya dibuang: sesi bawaan server ikut dibuang, kalau
    // tidak event itu lahir dengan sesi yang sudah dihapus orangnya di layar.
    if (!drafSesi.length && sesiBawaan) {
      await $fetch(`/api/admin/sesi/${sesiBawaan}`, { method: 'DELETE' })
    }

    // Peserta terakhir, dan sengaja: kalau salah satunya ditolak (email bentrok
    // dengan yang lain di daftar yang sama), event beserta seluruh materinya sudah
    // aman tersimpan — yang perlu diulang cuma satu baris peserta, di halaman ubah
    // yang sudah terbuka.
    for (const p of pesertaDraf.value) {
      await $fetch(`/api/admin/events/${kegiatanId}/peserta`, {
        method: 'POST',
        body: {
          nama: p.nama, email: p.email, noHp: p.noHp,
          catatan: p.catatan, status: p.status,
        },
      })
    }

    await router.replace(`/admin/event/${kegiatanId}`)
    toast.add({ title: 'Event dibuat', icon: 'i-lucide-check', color: 'primary', duration: 2000 })
    return true
  }
  catch (e: any) { galat.value = pesan(e, 'Gagal menyimpan event.'); return false }
  finally { sibuk.value = false }
}

// ── Autosave ─────────────────────────────────────────────────────────────────
// Polanya sama dengan SesiPengaturan.vue yang duduk di tab sebelah: jeda 800 ms
// sesudah pengetikan berhenti, dan draf dibandingkan dulu supaya isian yang tidak
// berubah tidak menghasilkan permintaan.
//
// Yang berbeda cuma kabarnya. Di sana ada baris "menyimpan…/tersimpan" yang
// menetap; di sini toast sekejap. Baris menetap masuk akal untuk satu baris
// pengaturan, tapi di formulir sepanjang ini ia jadi teks yang berkedip di sudut
// mata setiap kali satu huruf diketik.
//
// Galat TIDAK lewat toast: yang gagal harus tetap terbaca sesudah tiga detik
// berlalu, jadi ia mengendap di UAlert di kepala halaman.
let timer: ReturnType<typeof setTimeout> | undefined

/**
 * Keadaan autosave, digambar `IndikatorSimpan` di kepala halaman.
 *
 * `menunggu` menyala sejak ketikan berhenti, bukan sejak permintaannya berangkat:
 * jeda 800 ms itu bagian dari penyimpanan bagi yang menatap layar, dan lingkaran
 * yang baru muncul sesudahnya membuat detik pertama terbaca sebagai "tidak
 * terjadi apa-apa".
 */
const keadaanSimpan = ref<'diam' | 'menunggu' | 'menyimpan' | 'tersimpan' | 'gagal'>('diam')

const simpanSekarang = async () => {
  if (baru.value) return

  // Isian yang belum sah tetap tidak dikirim — tapi penolakannya TIDAK BOLEH DIAM.
  //
  // Versi sebelumnya menyetel `keadaanSimpan = 'diam'` lalu keluar, dengan alasan
  // "pesannya sudah tergambar di `peringatan`". Alasan itu keliru dalam praktik:
  // peringatannya digambar di ujung bawah kartu, di bawah kotak unggah gambar,
  // sementara isian yang memicunya (tanggal, jam, batas pendaftaran) ada jauh di
  // atasnya. Yang mengetik di sana melihat indikator simpan kembali ke diam, tanpa
  // toast, tanpa galat — dan menyimpulkan satu-satunya hal yang masuk akal dari
  // apa yang terlihat: formulirnya rusak.
  //
  // Sekarang alasannya mendarat di tempat kegagalan lain sudah mendarat: UAlert di
  // kepala halaman, plus indikator `gagal`. Satu penolakan, satu kabar.
  if (penghalangSimpan.value) {
    keadaanSimpan.value = 'gagal'
    galat.value = penghalangSimpan.value
    return
  }
  if (sidik() === tersimpan.value) { keadaanSimpan.value = 'diam'; return }

  const dikirim = sidik()
  sibuk.value = true
  keadaanSimpan.value = 'menyimpan'
  galat.value = ''
  try {
    await $fetch(`/api/admin/events/${id.value}`, { method: 'PATCH', body: payload() })
    tersimpan.value = dikirim
    keadaanSimpan.value = 'tersimpan'
    toast.add({ title: 'Tersimpan', icon: 'i-lucide-check', color: 'primary', duration: 1000 })
  }
  catch (e: any) {
    keadaanSimpan.value = 'gagal'
    galat.value = pesan(e, 'Gagal menyimpan event.')
  }
  finally { sibuk.value = false }
}

watch(form, () => {
  if (baru.value) return
  clearTimeout(timer)
  keadaanSimpan.value = 'menunggu'
  timer = setTimeout(simpanSekarang, 800)
}, { deep: true })

onBeforeUnmount(() => clearTimeout(timer))

// ── Tindakan sesi & item ─────────────────────────────────────────────────────
//
// Semuanya menyimpan seketika dan tidak punya tombol simpan, jadi masing-masing
// harus menunjukkan bahwa ia sedang berjalan. Satu ref berisi KUNCI tindakan yang
// sedang jalan, bukan satu boolean: dengan boolean, menggeser satu foto akan
// membuat seluruh tombol di panel berputar sekaligus, dan yang mana yang sedang
// dikerjakan justru jadi tidak terbaca.
//
// Tiap tindakan memuat ulang seluruh halaman event sesudahnya (`muat()`), jadi
// jedanya bukan nol — tanpa penanda, klik pada "geser" terasa seperti tidak
// diterima dan ditekan dua kali.
const aksiSibuk = ref('')

const jalankanAksi = async (kunci: string, kerja: () => Promise<void>, pesanGagal: string) => {
  if (aksiSibuk.value) return
  aksiSibuk.value = kunci
  galat.value = ''
  try {
    await kerja()
    await muat()
  }
  catch (e: any) { galat.value = pesan(e, pesanGagal) }
  finally { aksiSibuk.value = '' }
}

// ── Draf sesi (khusus event baru) ────────────────────────────────────────────
//
// Pada event baru TIDAK ADA satu permintaan pun sampai "Buat event" ditekan — tab
// mana pun. Sesi dan itemnya hidup di `sesi` yang sama seperti pada event
// tersimpan, cuma dengan id sementara, sehingga seluruh template di bawah tidak
// perlu tahu bedanya.
//
// Id sementara berawalan `tmp-` supaya tidak mungkin tertukar dengan id server, dan
// nomornya naik terus — memakai panjang larik sebagai nomor menghasilkan id yang
// dipakai ulang sesudah ada yang dihapus, dan `:key` yang berulang membuat Vue
// menggambar ulang isian milik sesi lain.
let nomorTmp = 0
const tmpId = () => `tmp-${++nomorTmp}`

const sesiKosong = () => ({
  id: tmpId(),
  judul: `Sesi ${sesi.value.length + 1}`,
  judulEn: sesi.value.length === 0 ? 'Session 1' : '',
  tampil: true,
  materi: [] as any[],
  galeri: [] as any[],
  referensi: [] as any[],
})

/** Event baru selalu dibuka dengan satu sesi — cerminan dari apa yang dilakukan
    server saat event dibuat, supaya yang terlihat di layar sama sebelum dan sesudah. */
if (baru.value) sesi.value = [sesiKosong()]

const cariSesi = (sesiId: string) => sesi.value.find(s => s.id === sesiId)

const geserDalamLarik = (arr: any[], i: number, arah: 'naik' | 'turun') => {
  const j = arah === 'naik' ? i - 1 : i + 1
  if (j < 0 || j >= arr.length) return
  arr.splice(j, 0, arr.splice(i, 1)[0])
}

const tambahSesi = () => {
  if (baru.value) { sesi.value.push(sesiKosong()); return }
  jalankanAksi(
    'tambah-sesi',
    async () => { await $fetch('/api/admin/sesi', { method: 'POST', body: { kegiatanId: id.value } }) },
    'Gagal menambah sesi.',
  )
}

// `simpanSesi` dihapus bersama tombolnya: SesiPengaturan.vue kini menyimpan
// sendiri 800 ms setelah pengetikan berhenti — kecuali pada draf, yang
// mengembalikan perubahannya lewat `ubahSesi` di bawah.

const ubahSesi = (s: any, nilai: { judul: string, judulEn: string, tampil: boolean }) => {
  Object.assign(s, nilai)
}

const hapusSesi = (s: any) => {
  if (baru.value) { sesi.value = sesi.value.filter(x => x.id !== s.id); return }
  jalankanAksi(
    `hapus-sesi-${s.id}`,
    async () => { await $fetch(`/api/admin/sesi/${s.id}`, { method: 'DELETE' }) },
    'Gagal menghapus sesi.',
  )
}

const geserSesi = (s: any, arah: 'naik' | 'turun') => {
  if (baru.value) { geserDalamLarik(sesi.value, sesi.value.indexOf(s), arah); return }
  jalankanAksi(
    `geser-sesi-${s.id}-${arah}`,
    async () => { await $fetch(`/api/admin/sesi/${s.id}/geser`, { method: 'POST', body: { arah } }) },
    'Gagal menggeser sesi.',
  )
}

// ── Item sesi ────────────────────────────────────────────────────────────────
// Formnya tinggal di components/SesiItemModal.vue, dipakai bersama penyuntingan di
// tempat pada halaman event publik. Aturan bentuk form — jenis apa untuk bagian
// mana, mana yang butuh berkas, kapan sakelar "khusus peserta" muncul — hanya ada
// di satu tempat, jadi keduanya tidak bisa menyimpang.
const itemModal = ref(false)
const itemSesiId = ref('')
const itemBagian = ref<'materi' | 'galeri' | 'referensi'>('materi')
const itemDiubah = ref<any>(null)

// Galeri punya jalannya sendiri: belasan foto dari acara yang sama, dipilih
// sekaligus lalu dipotong seperlunya. Form satu-item tetap dipakai untuk MENGUBAH
// foto yang sudah ada — di sana yang diubah biasanya keterangannya, bukan berkasnya.
const galeriModal = ref(false)

const bukaItem = (sesiId: string, bagian: 'materi' | 'galeri' | 'referensi') => {
  itemSesiId.value = sesiId
  itemBagian.value = bagian
  itemDiubah.value = null
  galat.value = ''
  if (bagian === 'galeri') { galeriModal.value = true; return }
  itemModal.value = true
}

const bukaUbahItem = (sesiId: string, item: any) => {
  itemSesiId.value = sesiId
  itemBagian.value = item.bagian
  itemDiubah.value = item
  galat.value = ''
  itemModal.value = true
}

// Foto galeri disunting, bukan diganti: pensilnya membuka pemotong, bukan form
// "pilih berkas pengganti". Lihat catatan di GaleriCropModal.vue.
const cropModal = ref(false)
const cropItem = ref<any>(null)

const bukaCrop = (item: any) => {
  cropItem.value = item
  galat.value = ''
  cropModal.value = true
}

/** Larik yang memuat sebuah item draf, beserta posisinya — dipakai geser & hapus. */
const letakItem = (itemId: string) => {
  for (const s of sesi.value) {
    for (const bagian of ['materi', 'galeri', 'referensi'] as const) {
      const i = (s[bagian] as any[]).findIndex(x => x.id === itemId)
      if (i >= 0) return { arr: s[bagian] as any[], i }
    }
  }
  return null
}

const geserItem = (itemId: string, arah: 'naik' | 'turun') => {
  if (baru.value) {
    const letak = letakItem(itemId)
    if (letak) geserDalamLarik(letak.arr, letak.i, arah)
    return
  }
  jalankanAksi(
    `geser-item-${itemId}-${arah}`,
    async () => { await $fetch(`/api/admin/sesi-item/${itemId}/geser`, { method: 'POST', body: { arah } }) },
    'Gagal menggeser item.',
  )
}

const hapusItem = (itemId: string) => {
  if (baru.value) {
    const letak = letakItem(itemId)
    if (letak) letak.arr.splice(letak.i, 1)
    return
  }
  jalankanAksi(
    `hapus-item-${itemId}`,
    async () => { await $fetch(`/api/admin/sesi-item/${itemId}`, { method: 'DELETE' }) },
    'Gagal menghapus item.',
  )
}

// ── Draf item (khusus event baru) ────────────────────────────────────────────
// Yang datang dari modal sudah berbentuk body yang akan dikirim nanti; yang
// ditambahkan di sini hanya id sementara dan `thumbnail`, alamat berkas untuk
// pratinjau yang TIDAK ikut terkirim ke server.

const drafItem = (isi: Record<string, any>) => {
  const s = cariSesi(itemSesiId.value)
  if (!s) return
  const bagian = isi.bagian as 'materi' | 'galeri' | 'referensi'

  if (itemDiubah.value) {
    // `mediaUrl` kosong berarti berkasnya tidak diganti — cuplikan yang sudah ada
    // dipertahankan, bukan dikosongkan jadi kotak "gambar hilang".
    const { bagian: _b, mediaUrl, ...sisa } = isi
    Object.assign(itemDiubah.value, sisa, mediaUrl ? { thumbnail: mediaUrl } : {})
    return
  }

  const { bagian: _b, mediaUrl, ...sisa } = isi
  ;(s[bagian] as any[]).push({ ...sisa, id: tmpId(), bagian, thumbnail: mediaUrl || null })
}

const drafGaleri = (daftar: Record<string, any>[]) => {
  const s = cariSesi(itemSesiId.value)
  if (!s) return
  for (const { mediaUrl, bagian: _b, ...sisa } of daftar) {
    s.galeri.push({ ...sisa, id: tmpId(), bagian: 'galeri', terkunci: false, thumbnail: mediaUrl || null })
  }
}

const drafCrop = (hasil: { mediaId: string, url: string }) => {
  if (!cropItem.value) return
  cropItem.value.mediaId = hasil.mediaId
  cropItem.value.thumbnail = hasil.url
}

/**
 * Tiga tab. Pembagiannya mengikuti tiga pekerjaan yang berbeda waktunya:
 * menyiapkan event (sebelum), mengurus pendaftar (selama pendaftaran dibuka),
 * dan mengunggah materi (setelah acara). Menumpuk ketiganya dalam satu halaman
 * panjang membuat pekerjaan yang sedang tidak dilakukan ikut menghalangi layar.
 *
 * Ketiganya ada juga pada event baru, sama seperti pada event yang sudah tersimpan.
 */
const tabs = [
  { value: 'info', label: 'Informasi utama', icon: 'i-lucide-file-text' },
  { value: 'peserta', label: 'Daftar peserta', icon: 'i-lucide-users' },
  { value: 'materi', label: 'Materi', icon: 'i-lucide-folder-open' },
]

/**
 * Tab pembuka boleh ditentukan pemanggil lewat `?tab=`.
 *
 * Dipakai dashboard: kartu "perlu diproses" dan angka di tabel event menuju
 * langsung ke pekerjaan yang dimaksud, bukan ke halaman event yang lalu harus
 * dicari sendiri tabnya. Nilai yang tidak dikenal diabaikan — alamat yang salah
 * ketik jangan sampai membuka halaman tanpa satu tab pun aktif.
 *
 * `?status=` diteruskan ke tab peserta sebagai chip yang terpilih; dibaca sekali
 * saat halaman dibuka, sesudah itu chipnya milik orang yang membukanya.
 */
const tabAwal = String(route.query.tab ?? '')
const tabAktif = ref(tabs.some(t => t.value === tabAwal) ? tabAwal : 'info')
const statusAwal = computed(() => String(route.query.status ?? ''))

/**
 * Berpindah tab TIDAK menyimpan apa pun, dan tidak membuat event.
 *
 * Ini sengaja: pada event baru satu-satunya hal yang menulis ke database adalah
 * tombol "Buat event". Kalau berpindah tab ikut melahirkan eventnya, keluar dari
 * tab pertama jadi tindakan yang akibatnya jauh lebih besar dari yang terlihat —
 * dan orang yang cuma mau MELIHAT tab sebelah sudah terlanjur menerbitkan sesuatu.
 *
 * Yang membuatnya mungkin: tab peserta & materi tidak lagi menuntut `kegiatanId`
 * pada mode baru. Sesi & materi disusun sebagai draf di memori (lihat "Draf sesi"),
 * dan seluruhnya dikirim sekali dari `buatEvent()`.
 */
// Formulir event baru selalu terbuka di tab pertama, dan drafnya dimulai dari nol —
// sesi yang tertinggal dari event yang barusan dilihat bukan pekerjaan siapa pun.
watch(baru, (b) => {
  if (!b) return
  tabAktif.value = 'info'
  nomorTmp = 0
  sesi.value = [sesiKosong()]
  pesertaDraf.value = []
})

// `petunjuk` ikut dicabut bersama tooltipnya — keterangan yang tidak digambar di
// mana pun cuma menunggu dipakai lagi oleh yang mengira ia masih tampil.
const BAGIAN = [
  { key: 'materi', label: 'Materi Pembelajaran', ikon: 'i-lucide-file-text' },
  { key: 'galeri', label: 'Galeri', ikon: 'i-lucide-images' },
  { key: 'referensi', label: 'Referensi', ikon: 'i-lucide-link' },
] as const
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <UButton to="/admin/events" color="neutral" variant="ghost" size="sm" icon="i-lucide-arrow-left" class="-ml-2 mb-1">
          Kembali ke daftar event
        </UButton>
        <h1 class="font-serif text-5xl text-cc-green-800">{{ baru ? 'Event baru' : form.judul || 'Ubah event' }}</h1>
      </div>
      <!-- Satu-satunya tombol simpan yang tersisa, dan ia hanya ada pada event
           baru: sesudah eventnya lahir, seluruh halaman ini menyimpan dirinya
           sendiri — identitas lewat autosave, peserta & materi lewat tindakannya
           masing-masing. Tempat tombol itu dulu berdiri kini ditempati penanda
           autosave, supaya mata yang mencari "sudah tersimpan belum" mendarat di
           tempat yang sama seperti sebelumnya. -->
      <div v-if="!baru" class="mt-3 flex items-center gap-2">
        <IndikatorSimpan :keadaan="keadaanSimpan" />

        <!-- Dua arah dalam satu tempat: yang sudah dibatalkan menawarkan pemulihan,
             yang masih berjalan menawarkan pembatalan. -->
        <UButton
          v-if="dibatalkan"
          color="neutral"
          variant="outline"
          size="sm"
          icon="i-lucide-rotate-ccw"
          :loading="memprosesStatus"
          @click="ubahStatusEvent('terbit')"
        >
          Pulihkan event
        </UButton>
        <UButton
          v-else
          color="error"
          variant="outline"
          size="sm"
          icon="i-lucide-ban"
          @click="konfirmasiBatal = true"
        >
          Batalkan event
        </UButton>
      </div>
      <!-- Tetap hidup meski isian belum lengkap. Tombol yang mati tidak bisa
           memberi tahu apa yang kurang — dan di halaman bertab seperti ini, kolom
           yang kosong bisa saja sedang tidak terlihat sama sekali. Menekannya
           memindahkan halaman ke tab yang bermasalah dan menyalakan kolomnya. -->
      <UButton
        v-if="baru"
        color="secondary"
        size="lg"
        icon="i-lucide-save"
        :loading="sibuk"
        @click="buatEvent"
      >
        Buat event
      </UButton>
    </div>

    <UTabs
      v-model="tabAktif"
      :items="tabs"
      :content="false"
      color="secondary"
      variant="link"
      class="mb-6"
    />

    <!-- Penanda keadaan, bukan sekadar hiasan: seluruh halaman ini tetap bisa
         disunting sesudah event dibatalkan, jadi tanpa spanduk tidak ada apa pun di
         layar yang memberi tahu bahwa yang sedang disunting adalah acara yang sudah
         dibatalkan. -->
    <UAlert
      v-if="dibatalkan"
      color="warning"
      variant="subtle"
      class="mb-4"
      icon="i-lucide-ban"
      title="Event ini telah dibatalkan"
      description="Halaman publiknya masih dapat dibuka dan ditandai sebagai dibatalkan, dan pendaftaran baru ditutup. Data peserta tetap tersimpan dan statusnya masih dapat diubah."
    />

    <!-- Galat mengendap di sini, tidak lewat toast: yang gagal harus tetap terbaca
         sesudah beberapa detik berlalu. Kabar berhasil justru sebaliknya. -->
    <UAlert v-if="galat" color="error" variant="subtle" class="mb-4" icon="i-lucide-triangle-alert" :description="galat" />

    <!-- Identitas event -->
    <UCard v-if="tabAktif === 'info'" class="mb-6">
      <template #header>
        <h2 class="font-serif text-2xl text-cc-green-800">Identitas event</h2>
      </template>

      <!-- Peringatan duduk DI ATAS isian, bukan di ujung bawah kartu.
           Sebelumnya ia digambar sesudah kotak unggah gambar — sementara isian yang
           memicunya (tanggal, jam, batas pendaftaran) ada di atasnya, dan di layar
           laptop peringatan itu berada di luar pandangan orang yang baru saja
           mengubah tanggal. Peringatan yang harus digulir untuk ditemukan tidak
           memperingatkan siapa pun. -->
      <UAlert
        v-if="peringatan"
        color="warning"
        variant="subtle"
        class="mb-4"
        icon="i-lucide-triangle-alert"
        :description="peringatan"
      />

      <div class="grid gap-4 md:grid-cols-2">
        <UFormField label="Judul (ID)" required :error="wajibKosong(form.judul, dicoba)">
          <UInput v-model="form.judul" class="w-full" placeholder="Leadership with Compassion" />
        </UFormField>
        <UFormField label="Judul (EN)" hint="opsional">
          <UInput v-model="form.judulEn" class="w-full" />
        </UFormField>

        <!-- Satu baris, bukan tiga. Kotak setinggi tiga baris menjanjikan karangan
             panjang, padahal yang ditulis di sini kalimat pengantar kartu event —
             dan tinggi kotaknya membuat sisa formulir terdorong jauh ke bawah.
             Isinya tetap bisa sepanjang apa pun; kotaknya yang menggulir. -->
        <UFormField label="Deskripsi (ID)" class="md:col-span-2">
          <UTextarea v-model="form.deskripsi" :rows="1" autoresize :maxrows="6" class="w-full" />
        </UFormField>
        <UFormField label="Deskripsi (EN)" class="md:col-span-2" hint="opsional">
          <UTextarea v-model="form.deskripsiEn" :rows="1" autoresize :maxrows="6" class="w-full" />
        </UFormField>

        <!-- Wajib. Acara daring pun punya lokasi — "Online via Zoom" — dan
             menuliskannya membedakan acara yang memang daring dari kolom yang
             sekadar lupa diisi. -->
        <UFormField label="Lokasi" required :error="wajibKosong(form.lokasi, dicoba)">
          <UInput v-model="form.lokasi" class="w-full" placeholder="Jakarta · Rumah Retret St. Ignatius" />
        </UFormField>
        <UFormField label="Tautan daring">
          <UInput v-model="form.tautanDaring" class="w-full" placeholder="https://zoom.us/j/…" />
        </UFormField>

        <UFormField label="Tanggal mulai" required :error="wajibKosong(form.tanggalMulai, dicoba)">
          <TanggalPicker v-model="form.tanggalMulai" placeholder="Pilih tanggal" />
        </UFormField>
        <UFormField label="Tanggal selesai">
          <!-- `minimal` menutup kesalahan yang paling sering: memilih tanggal
               mundur. Aturannya tetap diperiksa ulang di `peringatan` dan di
               server — kalender bukan penjagaan, ia kemudahan. -->
          <TanggalPicker
            v-model="form.tanggalSelesai"
            :minimal="form.tanggalMulai || null"
            placeholder="Pilih tanggal"
          />
        </UFormField>

        <!-- Jam acara. Terutama berarti untuk event sehari, yang tanggal selesainya
             tidak menambah informasi apa pun — jamnya yang menentukan. -->
        <UFormField label="Jam mulai">
          <WaktuPicker v-model="form.jamMulai" placeholder="Belum ditentukan" />
        </UFormField>
        <UFormField label="Jam selesai">
          <WaktuPicker
            v-model="form.jamSelesai"
            placeholder="Belum ditentukan"
            :minimal="sehari ? form.jamMulai : null"
          />
        </UFormField>

        <!-- Tanggal dan jam dipisah tanda "–", bukan sekadar berjajar dalam kisi.
             Dua kotak bersebelahan tanpa penghubung terbaca sebagai dua isian yang
             berdiri sendiri — dan jam di sebelah kanan tidak menjelaskan dirinya
             milik siapa. Dengan tandanya, keduanya terbaca satu tarikan: pendaftaran
             ditutup pada tanggal ini, jam sekian. -->
        <UFormField label="Batas akhir pendaftaran" class="md:col-span-2">
          <!-- Pembungkus div, bukan `class` pada pickernya: akar keduanya UPopover,
               yang tidak menggambar elemen sendiri — kelasnya tidak akan mendarat
               di mana pun. -->
          <div class="flex items-center gap-2">
            <div class="min-w-0 flex-1">
              <TanggalPicker
                v-model="form.tutupTanggal"
                :maksimal="form.tanggalMulai || null"
                placeholder="Sampai acara mulai"
              />
            </div>
            <span class="shrink-0 text-cc-stone-400" aria-hidden="true">–</span>
            <div class="min-w-0 flex-1">
              <WaktuPicker v-model="form.tutupJam" :disabled="!form.tutupTanggal" />
            </div>
          </div>
        </UFormField>

        <UFormField label="Kuota peserta">
          <UInput v-model="form.kuota" type="number" min="1" class="w-full" placeholder="Tanpa batas" />
        </UFormField>
      </div>

      <!-- Satu gambar untuk seluruh event. Yang diunggah adalah hasil potongan,
           bukan berkas aslinya; lihat catatan di GambarField.vue. Potongan 16:9
           yang dipilih di sini dipakai apa adanya di kepala halaman event, dan
           dipangkas dari sisi kiri-kanan oleh kartu daftar yang bingkainya lebih
           persegi. -->
      <div class="mt-6 border-t border-cc-stone-200 pt-6">
        <GambarField
          label="Gambar event"
          wajib
          :tanda-galat="!form.coverMediaId && (dicoba || !baru)"
          petunjuk="Dipakai di kepala halaman event sekaligus di kartu daftar event. Rasio 16:9."
          :url="gambar"
          :rasio="16 / 9"
          :lebar-pratinjau="288"
          @terpasang="pasangGambar($event)"
          @dilepas="lepasGambar()"
        />
      </div>

    </UCard>

    <!-- Daftar peserta -->
    <UCard v-else-if="tabAktif === 'peserta'">
      <!-- Judul dan tombolnya satu baris. Tombol yang berdiri di barisnya sendiri
           di bawah kepala kartu terbaca sebagai tindakan atas TABEL di bawahnya,
           padahal yang dilakukannya menambah baris ke daftar yang judulnya persis
           di atasnya. -->
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="font-serif text-2xl text-cc-green-800">Daftar peserta</h2>
          <UButton
            color="secondary"
            variant="soft"
            icon="i-lucide-user-plus"
            @click="pesertaModal = true"
          >
            Tambah peserta
          </UButton>
        </div>
      </template>

      <!-- Dua komponen, bukan satu dengan sakelar: pada event tersimpan pekerjaannya
           mengurus pendaftar yang punya riwayat (saring, cari, majukan status,
           batalkan, anulir); pada event baru yang ada cuma menambah dan membuang.
           Formnya sendiri sama persis — PesertaFormModal dipakai keduanya. -->
      <PesertaDraf v-if="baru" v-model="pesertaDraf" v-model:buka-tambah="pesertaModal" />
      <AdminPesertaTab
        v-else
        :kegiatan-id="id"
        :status-awal="statusAwal"
        v-model:buka-tambah="pesertaModal"
      />
    </UCard>

    <!-- Sesi & materi -->
    <UCard v-else-if="tabAktif === 'materi'">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="font-serif text-2xl text-cc-green-800">Sesi &amp; materi</h2>
            <p class="mt-1 text-sm text-cc-stone-600">
              {{ sesi.length }} sesi.
              <template v-if="baru">Disusun di sini, tersimpan saat “Buat event” ditekan.</template>
              <template v-else>Event baru otomatis dibekali satu sesi; tambah sendiri sesuai kebutuhan.</template>
            </p>
          </div>
          <UButton
            color="secondary"
            variant="soft"
            icon="i-lucide-plus"
            :loading="aksiSibuk === 'tambah-sesi'"
            :disabled="Boolean(aksiSibuk)"
            @click="tambahSesi"
          >
            Tambah sesi
          </UButton>
        </div>
      </template>

      <div v-if="!sesi.length" class="py-6 text-center text-sm text-cc-stone-500">
        Belum ada sesi.
      </div>

      <!-- Satu kotak = satu sesi, dan kotaknya krem. Sebelumnya seluruh isinya
           berlatar krem di dalam bingkai putih, sehingga batas antar sesi praktis
           tidak terlihat pada event yang punya beberapa sesi — yang terbaca cuma
           satu kolom panjang berisi bagian-bagian yang seragam. Sekarang
           kebalikannya: latar sesi krem, isi tiap bagian putih. -->
      <TransitionGroup name="urut" tag="div">
      <div
        v-for="(s, iSesi) in sesi"
        :key="s.id"
        class="mb-6 rounded-xl border border-cc-brown-300 bg-cc-stone-50 p-4 last:mb-0"
      >
        <!-- Kepala bernomor kini digambar SesiPengaturan, bersama sakelar Tampil
             dan tombol geser/hapus — satu baris untuk seluruh kendali sesi.
             Nomornya urutan tampil, bukan id: itu yang dipakai orang saat menyebut
             "sesi kedua". -->
        <!-- Judul & tanggal sesi menyimpan dirinya sendiri; komponen yang sama
             dipakai penyuntingan di halaman event publik. Sakelar "Tampil" ikut
             ditampilkan di sini: menyiapkan isi dan memutuskan apa yang terbit
             ternyata pekerjaan yang sama, dan tanpa sakelarnya tidak ada tempat
             lain di dashboard untuk menyembunyikan sesi yang belum siap. -->
        <SesiPengaturan
          :key="s.id"
          :sesi="s"
          :nomor="iSesi + 1"
          :lokal="baru"
          :pertama="sesi[0]?.id === s.id"
          :terakhir="sesi[sesi.length - 1]?.id === s.id"
          :sibuk="Boolean(aksiSibuk)"
          :aksi-sibuk="aksiSibuk"
          @tersimpan="muat()"
          @ubah="(nilai: any) => ubahSesi(s, nilai)"
          @geser="(arah: 'naik' | 'turun') => geserSesi(s, arah)"
          @hapus="hapusSesi(s)"
        />

        <!-- Tiga bagian jadi tiga baris penuh, bukan tiga kolom sempit. Judul
             materi hampir selalu panjang ("Rekaman sesi 2 — mendengarkan tanpa
             menilai"), dan di kolom selebar sepertiga layar semuanya terpotong jadi
             potongan yang tidak bisa dibedakan satu sama lain. -->
        <div class="space-y-3">
          <div v-for="b in BAGIAN" :key="b.key" class="rounded-lg border border-cc-stone-200 bg-white p-3">
            <div class="mb-2 flex items-center gap-1.5">
              <UIcon :name="b.ikon" class="size-4 text-cc-brown-500" />
              <span class="text-sm font-semibold text-cc-green-800">{{ b.label }}</span>
              <UBadge color="neutral" variant="subtle" size="sm" class="rounded-full">{{ s[b.key].length }}</UBadge>

              <UButton
                class="ml-auto"
                color="neutral"
                variant="soft"
                size="xs"
                icon="i-lucide-plus"
                @click="bukaItem(s.id, b.key)"
              >
                {{ b.key === 'galeri' ? 'Tambah foto' : 'Tambah' }}
              </UButton>
            </div>

            <p v-if="!s[b.key].length" class="py-1 text-xs text-cc-stone-500">
              Belum ada isi.
            </p>

            <!-- Galeri: pita cuplikan mendatar, bukan daftar baris berjudul.
                 Pada daftar foto, FOTONYA yang jadi isi — namanya
                 ("Screenshot 2026 04 07 092118") tidak membantu siapa pun mengenali
                 mana yang sedang dilihat, dan cuplikan 32px di sampingnya sama saja.
                 Bergulir mendatar, bukan membungkus: satu baris membuat urutannya
                 terbaca sebagai urutan, persis seperti saat fotonya diunggah. -->
            <TransitionGroup
              v-else-if="b.key === 'galeri'"
              name="urut"
              tag="div"
              class="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2"
            >
              <figure
                v-for="(item, i) in s[b.key]"
                :key="item.id"
                class="group relative w-32 shrink-0"
              >
                <img
                  v-if="item.thumbnail || item.url"
                  :src="item.thumbnail ?? item.url"
                  :alt="item.judul"
                  class="h-24 w-32 rounded-lg border border-cc-stone-200 bg-cc-stone-100 object-cover"
                  loading="lazy"
                >
                <div v-else class="grid h-24 w-32 place-items-center rounded-lg border border-cc-stone-200 bg-cc-stone-100">
                  <UIcon name="i-lucide-image-off" class="size-5 text-cc-stone-400" />
                </div>

                <!-- Sunting & hapus menempel di pojok kanan atas FOTONYA, bukan
                     berbaris di bawahnya bersama tombol geser. Keduanya bekerja pada
                     gambar itu sendiri; empat tombol seukuran sama dalam satu baris
                     membuat "hapus" duduk sejauh satu piksel dari "geser kanan". -->
                <div class="absolute right-1 top-1 flex gap-0.5 rounded-md bg-white/85 p-0.5 shadow-sm backdrop-blur-sm">
                  <UButton
                    color="neutral" variant="ghost" size="xs" icon="i-lucide-crop"
                    :aria-label="`Sunting foto ${item.judul}`"
                    :disabled="Boolean(aksiSibuk)" @click="bukaCrop(item)"
                  />
                  <UButton
                    color="error" variant="ghost" size="xs" icon="i-lucide-x"
                    :aria-label="`Hapus foto ${item.judul}`"
                    :loading="aksiSibuk === `hapus-item-${item.id}`"
                    :disabled="Boolean(aksiSibuk)" @click="hapusItem(item.id)"
                  />
                </div>

                <!-- Yang tinggal di bawah cuma urutan — pekerjaan yang berbeda dari
                     menyunting gambarnya. -->
                <div class="mt-1 flex items-center justify-center">
                  <UButton
                    color="neutral" variant="ghost" size="xs" icon="i-lucide-chevron-left"
                    aria-label="Geser ke kiri"
                    :loading="aksiSibuk === `geser-item-${item.id}-naik`"
                    :disabled="i === 0 || Boolean(aksiSibuk)" @click="geserItem(item.id, 'naik')"
                  />
                  <UButton
                    color="neutral" variant="ghost" size="xs" icon="i-lucide-chevron-right"
                    aria-label="Geser ke kanan"
                    :loading="aksiSibuk === `geser-item-${item.id}-turun`"
                    :disabled="i === s[b.key].length - 1 || Boolean(aksiSibuk)" @click="geserItem(item.id, 'turun')"
                  />
                </div>
              </figure>
            </TransitionGroup>

            <TransitionGroup v-else name="urut" tag="ul" class="space-y-1">
              <li
                v-for="(item, i) in s[b.key]"
                :key="item.id"
                class="flex items-center gap-2 rounded border border-cc-stone-200 bg-white px-2 py-1.5 text-xs"
              >
                <UIcon v-if="item.terkunci" name="i-lucide-lock" class="size-3 shrink-0 text-cc-stone-400" />
                <span class="min-w-0 flex-1 break-words" :title="item.judul">{{ item.judul }}</span>
                <UButton
                  color="neutral" variant="ghost" size="xs" icon="i-lucide-chevron-up"
                  aria-label="Geser ke atas" :disabled="i === 0" @click="geserItem(item.id, 'naik')"
                />
                <UButton
                  color="neutral" variant="ghost" size="xs" icon="i-lucide-chevron-down"
                  aria-label="Geser ke bawah" :disabled="i === s[b.key].length - 1" @click="geserItem(item.id, 'turun')"
                />
                <UButton
                  color="neutral" variant="ghost" size="xs" icon="i-lucide-pencil"
                  aria-label="Ubah item" @click="bukaUbahItem(s.id, item)"
                />
                <UButton
                  color="error" variant="ghost" size="xs" icon="i-lucide-x"
                  aria-label="Hapus item" @click="hapusItem(item.id)"
                />
              </li>
            </TransitionGroup>
          </div>
        </div>
      </div>
      </TransitionGroup>
    </UCard>

    <!-- Tambah / ubah item. Pada event baru ketiganya mengembalikan drafnya lewat
         `draf` alih-alih menyimpan sendiri — berkasnya tetap naik, barisnya tidak. -->
    <SesiItemModal
      v-model:open="itemModal"
      :sesi-id="itemSesiId"
      :bagian="itemBagian"
      :item="itemDiubah"
      :lokal="baru"
      @tersimpan="muat()"
      @draf="drafItem"
    />

    <!-- Putar & potong foto galeri yang sudah terunggah -->
    <GaleriCropModal
      v-model:open="cropModal"
      :item="cropItem"
      :lokal="baru"
      @tersimpan="muat()"
      @draf="drafCrop"
    />

    <!-- Unggah banyak foto galeri sekaligus -->
    <GaleriUnggahModal
      v-model:open="galeriModal"
      :sesi-id="itemSesiId"
      :lokal="baru"
      @tersimpan="muat()"
      @draf="drafGaleri"
    />

    <!-- Konfirmasi pembatalan. Bahasanya menyebutkan akibat yang benar-benar terjadi,
         bukan sekadar bertanya "Anda yakin?" — pertanyaan itu tidak menambah
         informasi apa pun bagi yang sedang ragu. -->
    <UModal :open="konfirmasiBatal" title="Batalkan event" @update:open="konfirmasiBatal = $event">
      <template #body>
        <p class="text-sm text-cc-stone-700">
          Anda akan membatalkan <strong>{{ form.judul || 'event ini' }}</strong>.
        </p>

        <ul class="mt-3 space-y-2 text-sm text-cc-stone-600">
          <li class="flex gap-2">
            <UIcon name="i-lucide-dot" class="mt-0.5 size-4 shrink-0 text-cc-brown-500" />
            <span>Halaman event tetap dapat dibuka publik dan akan ditandai sebagai dibatalkan.</span>
          </li>
          <li class="flex gap-2">
            <UIcon name="i-lucide-dot" class="mt-0.5 size-4 shrink-0 text-cc-brown-500" />
            <span>Pendaftaran baru ditutup, terlepas dari tanggal yang tercantum.</span>
          </li>
          <li class="flex gap-2">
            <UIcon name="i-lucide-dot" class="mt-0.5 size-4 shrink-0 text-cc-brown-500" />
            <span>Data peserta yang telah terdaftar tidak dihapus, dan statusnya tetap dapat diubah.</span>
          </li>
          <li class="flex gap-2">
            <UIcon name="i-lucide-dot" class="mt-0.5 size-4 shrink-0 text-cc-brown-500" />
            <span>Pembatalan ini dapat dianulir sewaktu-waktu melalui tombol <strong>Pulihkan event</strong>.</span>
          </li>
        </ul>
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" :disabled="memprosesStatus" @click="konfirmasiBatal = false">
            Kembali
          </UButton>
          <UButton color="error" :loading="memprosesStatus" @click="ubahStatusEvent('batal')">
            Ya, batalkan event
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
