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

const { data, refresh } = await useFetch(() => `/api/events/${slug.value}/detail`)
const { data: sesiData } = await useFetch(() => `/api/events/${slug.value}/sesi`)

const e = computed(() => data.value?.data ?? null)
const sesi = computed(() => sesiData.value?.data ?? [])
const masuk = computed(() => Boolean(sesiData.value?.meta.masuk))

if (!e.value) {
  throw createError({ statusCode: 404, statusMessage: 'Event tidak ditemukan', fatal: true })
}

const { bolehSunting } = useEditMode()

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
  const tempat = (e.value.lokasi ?? '').split('·')[0].trim()
  return tempat ? `${tgl} · ${tempat}` : tgl
})

const testimoni = computed(() => e.value?.testimoni ?? [])

/** Sampul: dari DB bila ada, kalau tidak gambar statis milik event itu. Pola yang
    sama dipakai pages/events.vue supaya kartu dan halaman detail tidak berbeda. */
const SAMPUL: Record<string, string> = {
  'listening-as-leadership': '/images/listening-as-leadership.png',
  'leadership-with-compassion': '/images/leadership-with-compassion.png',
  'compassion-in-practice': '/images/listening-as-leadership.png',
}
const sampul = computed(() =>
  e.value?.cover || SAMPUL[e.value?.slug ?? ''] || '/images/event-gallery-placeholder.png')

// Label pendaftaran (biaya, kuota, keadaan tombol) tinggal di EventRegisterPanel
// bersama markup-nya, supaya tidak ada dua tempat yang harus diubah bersamaan.
const t = computed(() => isEn.value
  ? {
      kembali: 'Events', info: 'Event information', tanggal: 'Date', waktu: 'Time', lokasi: 'Location',
      testimoniJudul: 'What they said', testimoniEyebrow: 'Participant testimonies',
    }
  : {
      kembali: 'Events', info: 'Informasi acara', tanggal: 'Tanggal', waktu: 'Waktu', lokasi: 'Lokasi',
      testimoniJudul: 'Apa kata mereka', testimoniEyebrow: 'Testimoni peserta',
    })
</script>

<template>
  <main v-if="e" class="event-page">
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
              <div>
                <dt>{{ t.waktu }}</dt>
                <dd>
                  <EditableText :model-value="e.waktu" field="waktu" label="Waktu acara" :simpan="simpanKolom">
                    {{ e.waktu ?? '—' }}
                  </EditableText>
                </dd>
              </div>
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

        <!-- Panel pendaftaran + testimoni -->
        <div>
          <EventRegisterPanel :event="e" :is-en="isEn" @berhasil="refresh()" />

          <aside v-if="testimoni.length" class="testimonials panel mt-5">
            <div class="eyebrow">{{ t.testimoniEyebrow }}</div>
            <h2 class="section-title">{{ t.testimoniJudul }}</h2>
            <div class="testimonial-list">
              <div v-for="(k, i) in testimoni" :key="i" class="comment">
                <strong>{{ k.nama }}</strong>
                <p>“{{ k.teks }}”</p>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <EventResources v-if="sesi.length" :sesi="sesi" :is-en="isEn" :masuk="masuk" />
    </div>

    <AdminEditBar v-if="bolehSunting" :admin-path="`/admin/event/${e.id}`" />
  </main>
</template>
