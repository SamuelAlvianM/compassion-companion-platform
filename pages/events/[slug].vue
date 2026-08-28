<script setup lang="ts">
// Halaman detail event — satu berkas untuk semua event, isinya dari database.
//
// Menggantikan tiga halaman hardcoded (leadership-with-compassion,
// listening-as-leadership, compassion-in-practice) yang teks & jadwalnya ditulis
// tetap di dalam .vue. Karena isinya kini baris database, pengelola level ≤ 3 bisa
// menyuntingnya langsung di halaman ini lewat <EditableText>.

const route = useRoute()
const slug = computed(() => String(route.params.slug))
const base = computed(() => route.path.startsWith('/en') ? '/en' : '/id')
const isEn = computed(() => base.value === '/en')

// Sengaja TANPA `await`. Dengan await, <script setup> jadi async dan Vue menahan
// komponennya sampai fetch selesai; digabung pageTransition mode 'out-in', halaman
// lama keluar dulu lalu yang baru ditahan — itulah layar kosong yang terlihat saat
// berpindah ID/EN atau keluar akun. Tanpa await, rangkanya langsung tergambar.
const { data, status, error, refresh } = useFetch(() => `/api/events/${slug.value}/detail`)
const { data: sesiData, refresh: refreshSesi } = useFetch(() => `/api/events/${slug.value}/sesi`)

const e = computed(() => data.value?.data ?? null)
const sesi = computed(() => sesiData.value?.data ?? [])
const masuk = computed(() => Boolean(sesiData.value?.meta.masuk))

/**
 * Rangka tampil selama belum ada event yang bisa digambar.
 *
 * Sengaja TIDAK diikat ke `status === 'pending'`. Saat kunci fetch berganti —
 * yang terjadi tiap berpindah /id ↔ /en — status sempat bernilai `idle` sebelum
 * menjadi `pending`, dan pada jendela itu tidak ada satu pun cabang yang benar:
 * datanya sudah kosong, tapi rangkanya belum menyala. Itulah kedipan yang
 * terlihat. Menanyakan "sudah ada datanya belum" tidak punya celah itu.
 *
 * Saat menyimpan suntingan, `data` tetap terisi sehingga halaman tidak berkedip
 * tiap satu kolom disimpan.
 */
const memuatAwal = computed(() => !e.value && !error.value)

// 404 tidak bisa lagi diputuskan di setup karena datanya belum ada di sana.
//
// Dipakai `showError()`, bukan `throw createError()`. Melempar dari dalam watcher
// tidak sampai ke penangan galat Nuxt — errornya menggantung di luar siklus render
// dan komponennya berhenti tergambar sama sekali, menyisakan header dan footer
// tanpa isi. `showError` memang dirancang untuk dipanggil dari luar setup.
//
// Syaratnya `success`, bukan "bukan pending": pada keadaan `idle` datanya juga
// kosong, dan mem-404-kan di situ akan menolak event yang sebenarnya ada.
watch([status, error], () => {
  if (error.value || (status.value === 'success' && !e.value)) {
    showError({ statusCode: 404, statusMessage: 'Event tidak ditemukan' })
  }
})

const { aktif, bolehSunting } = useEditMode()

/**
 * Penyimpan untuk seluruh <EditableText> di halaman ini. PATCH-nya parsial —
 * hanya kolom yang disunting yang dikirim, sisanya ditumpuk di server dari baris
 * yang sudah ada.
 */
const simpanKolom = async (field: string, nilai: string) => {
  await $fetch(`/api/admin/events/${e.value!.id}`, {
    method: 'PATCH',
    body: { [field]: nilai },
  })
  await refresh()
}

/**
 * Beberapa kolom sekaligus dalam satu PATCH — dipakai blok jadwal, yang jam acara
 * dan batas pendaftarannya harus tersimpan bersama atau tidak sama sekali.
 */
const simpanBanyak = async (body: Record<string, unknown>) => {
  await $fetch(`/api/admin/events/${e.value!.id}`, { method: 'PATCH', body })
  await refresh()
}

/**
 * Testimoni memakai endpoint yang sama, tapi mengirim daftar utuh: ia satu kolom
 * JSON tanpa id per baris, jadi tidak ada yang bisa di-PATCH sepotong.
 */
const simpanTestimoni = async (daftar: { nama: string, teks: string }[]) => {
  await $fetch(`/api/admin/events/${e.value!.id}`, {
    method: 'PATCH',
    body: { testimoni: daftar },
  })
  await refresh()
}

const judul = computed(() => (isEn.value ? e.value?.judulEn ?? e.value?.judul : e.value?.judul) ?? '')
const deskripsi = computed(() => (isEn.value ? e.value?.deskripsiEn ?? e.value?.deskripsi : e.value?.deskripsi) ?? '')
const ajakan = computed(() => (isEn.value ? e.value?.ajakanEn ?? e.value?.ajakan : e.value?.ajakan) ?? '')
const ajakanIsi = computed(() => (isEn.value ? e.value?.ajakanIsiEn ?? e.value?.ajakanIsi : e.value?.ajakanIsi) ?? '')

// Kolom mana yang disunting mengikuti bahasa yang sedang dibuka: membuka /en lalu
// menyunting judul harus mengubah judul_en, bukan menimpa judul Indonesia.
const kolom = (dasar: string) => isEn.value ? `${dasar}En` : dasar

useSeoMeta({
  title: () => judul.value,
  description: () => deskripsi.value,
})

const tanggal = (nilai: string | null) => nilai
  ? new Intl.DateTimeFormat(isEn.value ? 'en-GB' : 'id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta',
    }).format(new Date(nilai))
  : '—'

const rentang = computed(() => {
  if (!e.value) return ''
  const mulai = tanggal(e.value.tanggalMulai)
  if (!e.value.tanggalSelesai || e.value.tanggalSelesai === e.value.tanggalMulai) return mulai
  return `${mulai} – ${tanggal(e.value.tanggalSelesai)}`
})

const faseLabel = computed(() => ({
  mendatang: isEn.value ? 'Upcoming' : 'Mendatang',
  berlangsung: isEn.value ? 'Ongoing' : 'Berlangsung',
  selesai: isEn.value ? 'Completed' : 'Selesai',
  batal: isEn.value ? 'Cancelled' : 'Dibatalkan',
}[e.value?.fase ?? 'mendatang']))

const eyebrow = computed(() => {
  if (!e.value) return ''
  const tgl = new Intl.DateTimeFormat(isEn.value ? 'en-GB' : 'id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta',
  }).format(new Date(e.value.tanggalMulai))
  // `?? ''` di ujung: hasil split selalu punya elemen pertama, tapi tipenya ikut
  // memuat undefined karena indeks larik tidak diperiksa TS.
  const tempat = ((e.value.lokasi ?? '').split('·')[0] ?? '').trim()
  return tempat ? `${tgl} · ${tempat}` : tgl
})

const testimoni = computed(() => e.value?.testimoni ?? [])

/**
 * Jurnal bertipe "event reflection" yang menunjuk event ini.
 *
 * Refleksi peserta sudah lama ditulis sebagai jurnal — lengkap dengan alur review
 * dan halaman bacanya sendiri — tapi halaman eventnya tidak pernah menyebutkan
 * bahwa tulisan-tulisan itu ada. Yang mencarinya harus menebak untuk membuka
 * /jurnal lalu menyaring sendiri berdasarkan nama event.
 *
 * Disaring di klien dari daftar jurnal yang sudah terbit. Alasannya sama seperti
 * penyaringan di halaman /jurnal: daftarnya puluhan, bukan ribuan, jadi endpoint
 * baru hanya menambah satu tempat yang harus dijaga tetap sama aturannya.
 *
 * Yang diambil RINGKASANNYA saja, bukan isinya. Isi jurnal bisa ribuan karakter,
 * dan panel di samping halaman event bukan tempat membaca artikel utuh — untuk itu
 * ada tautan "baca lebih lanjut" ke halamannya sendiri.
 */
const { data: semuaJurnal } = useFetch('/api/jurnal')

const refleksiJurnal = computed(() => {
  const id = e.value?.id
  if (!id) return []
  return (semuaJurnal.value?.data ?? [])
    .filter((j: any) => j.kegiatanId === id && j.tipe === 'event-reflection')
    .map((j: any) => ({
      slug: j.slug,
      judul: (isEn.value ? (j.judulEn ?? j.judul) : j.judul) ?? '',
      ringkasan: (isEn.value ? (j.ringkasanEn ?? j.ringkasan) : j.ringkasan) ?? '',
      kontributor: j.kontributor,
    }))
})

/** Sampul: dari DB bila ada, kalau tidak gambar statis milik event itu, dan kalau
    keduanya tidak ada — template. Aturannya tinggal di utils/mediaHelper.ts, satu
    tempat untuk kartu daftar dan halaman ini. */
const sampul = computed(() => sampulEvent(e.value?.slug, e.value?.cover))

// Label pendaftaran (biaya, kuota, keadaan tombol) tinggal di EventRegisterPanel
// bersama markup-nya, dan label testimoni di EventTestimoni — supaya tidak ada dua
// tempat yang harus diubah bersamaan.
// Label panel refleksi tinggal di EventTestimoni bersama markup-nya, sejak jurnal
// dan testimoni digabung ke satu panel di sana.
const t = computed(() => isEn.value
  ? { kembali: 'Events', info: 'Event information', tanggal: 'Date', waktu: 'Time', lokasi: 'Location' }
  : { kembali: 'Events', info: 'Informasi acara', tanggal: 'Tanggal', waktu: 'Waktu', lokasi: 'Lokasi' })
</script>

<template>
  <SkeletonDetailEvent v-if="memuatAwal" />

  <main v-else-if="e" class="event-page">
    <div class="container">
      <div class="page-head">
        <nav class="breadcrumb">
          <NuxtLink :to="`${base}/events`">{{ t.kembali }}</NuxtLink><span>›</span><span>{{ faseLabel }}</span>
        </nav>
        <div class="eyebrow">{{ eyebrow }}</div>

        <h1>
          <EditableText :model-value="judul" :field="kolom('judul')" label="Judul event" :simpan="simpanKolom">
            {{ judul }}
          </EditableText>
        </h1>

        <p>
          <EditableText :model-value="deskripsi" :field="kolom('deskripsi')" label="Deskripsi singkat" multiline :simpan="simpanKolom">
            {{ deskripsi }}
          </EditableText>
        </p>
      </div>

      <div class="event-detail-grid">
        <section class="event-overview">
          <img :src="sampul" :alt="judul">

          <div class="event-information panel">
            <div class="eyebrow">{{ t.info }}</div>
            <dl>
              <div><dt>{{ t.tanggal }}</dt><dd>{{ rentang }}</dd></div>

              <!-- Jam acara & batas pendaftaran: nilainya terstruktur, jadi
                   penyuntingannya memakai pemilih jam, bukan kotak teks bebas. -->
              <EventJadwal :event="e" :is-en="isEn" :simpan="simpanBanyak" />

              <div>
                <dt>{{ t.lokasi }}</dt>
                <dd>
                  <EditableText :model-value="e.lokasi" field="lokasi" label="Lokasi" :simpan="simpanKolom">
                    {{ e.lokasi ?? '—' }}
                  </EditableText>
                </dd>
              </div>
            </dl>

            <h2>
              <EditableText :model-value="ajakan" :field="kolom('ajakan')" label="Ajakan" :simpan="simpanKolom">
                {{ ajakan }}
              </EditableText>
            </h2>
            <p class="muted">
              <EditableText :model-value="ajakanIsi" :field="kolom('ajakanIsi')" label="Isi ajakan" multiline :simpan="simpanKolom">
                {{ ajakanIsi }}
              </EditableText>
            </p>
          </div>
        </section>

        <!-- Panel pendaftaran + refleksi.
             `space-y-6`: sebelumnya keduanya menempel tanpa jarak sama sekali, jadi
             "Pendaftaran ditutup." dan "Refleksi event" terbaca sebagai satu blok
             yang sama — padahal yang satu kabar tentang pendaftaran dan yang lain
             suara peserta sesudah acaranya usai.

             Panel pendaftarannya sendiri TIDAK dihilangkan pada event selesai.
             "Pendaftaran ditutup, ditutup pada 15 Mei 2026" masih menjawab
             pertanyaan yang wajar bagi yang baru menemukan halamannya — dan
             menghapusnya berarti halaman event selesai tidak lagi punya satu pun
             keterangan tentang pendaftarannya. -->
        <div class="space-y-6">
          <EventRegisterPanel :event="e" :is-en="isEn" @berhasil="refresh()" />

          <!-- Refleksi event hanya pada event yang sudah SELESAI.
               Panel ini berisi apa yang dikatakan orang setelah mengikutinya, jadi
               pada event mendatang ia menjanjikan sesuatu yang belum ada, dan pada
               event yang sedang berlangsung ia mendahului acaranya sendiri. Juga
               disembunyikan dari mode sunting: tidak ada yang bisa ditulis sebelum
               eventnya usai. -->
          <!-- Satu panel untuk keduanya: testimoni ketikan DAN tulisan lengkap
               dari jurnal. Sebelumnya jurnalnya berdiri sebagai panel kedua, dan
               dua panel berjudul "Refleksi event" bersebelahan membuat pembacanya
               menebak apa bedanya.

               Syarat fase dilonggarkan: panel ini tetap muncul kalau ADA jurnal
               refleksinya, meski eventnya belum ditandai selesai. Jurnal hanya bisa
               terbit lewat alur redaksi, jadi keberadaannya sendiri sudah cukup
               jadi syarat — dan refleksi yang terbit lebih awal tidak ada alasannya
               disembunyikan. -->
          <EventTestimoni
            v-if="e.fase === 'selesai' || refleksiJurnal.length"
            :daftar="testimoni"
            :refleksi="refleksiJurnal"
            :base="base"
            :is-en="isEn"
            :simpan="simpanTestimoni"
          />

        </div>
      </div>

      <!-- Saat mode sunting menyala, blok ini tetap tergambar meski belum ada satu
           sesi pun — kalau tidak, event baru tidak punya tempat untuk menekan
           "Tambah sesi". -->
      <EventResources
        v-if="sesi.length || aktif"
        :sesi="sesi"
        :is-en="isEn"
        :masuk="masuk"
        :kegiatan-id="e.id"
        @ubah="refreshSesi()"
      />
    </div>

    <AdminEditBar v-if="bolehSunting" :admin-path="`/admin/event/${e.id}`" />
  </main>
</template>
