<script setup lang="ts">
const route = useRoute()
const isEn = computed(() => route.path.startsWith('/en'))

useSeoMeta({
  title: 'Listening as Leadership',
  description: () => isEn.value
    ? 'Documentation of the May 2026 gathering on leading through presence and the art of listening — materials, gallery, and participant testimonies.'
    : 'Dokumentasi perjumpaan Mei 2026 tentang memimpin melalui kehadiran dan seni mendengarkan — materi, galeri, dan testimoni peserta.',
})


// Sesi & materi dari database. Aturan aksesnya ditegakkan di server:
// materi hanya terkirim lengkap bagi peserta event dan pengelola level <= 3.
const { data: sesiData } = await useFetch('/api/events/listening-as-leadership/sesi')
const sesi = computed(() => sesiData.value?.data ?? [])
const masuk = computed(() => Boolean(sesiData.value?.meta.masuk))
</script>

<template>
  <main class="event-page">
    <div class="container">
      <div class="page-head"><nav class="breadcrumb"><NuxtLink to="/id/events">Events</NuxtLink><span>›</span><span>Selesai</span></nav><div class="eyebrow">Selesai - Mei 2026</div><h1>Listening as Leadership</h1><p>Belajar memimpin melalui kehadiran dan seni mendengarkan.</p></div>
      <div class="event-detail-grid">
        <section class="event-overview"><img src="/images/listening-as-leadership.png" alt="Listening as Leadership"><div class="event-information panel"><div class="eyebrow">Informasi acara</div><dl><div><dt>Tanggal</dt><dd>18 Mei 2026</dd></div><div><dt>Waktu</dt><dd>09.00-16.00 WIB</dd></div><div><dt>Lokasi</dt><dd>Online via Zoom</dd></div></dl><h2>Mendengarkan, memahami, lalu melangkah bersama.</h2><p class="muted">Dalam perjumpaan ini para peserta berbagi pengalaman, berlatih memberi ruang bagi suara yang sering tidak terdengar, dan merefleksikan cara hadir bagi sesama.</p></div></section>
        <aside class="testimonials panel"><div class="eyebrow">Testimoni peserta</div><h2 class="section-title">Apa kata mereka</h2><div class="testimonial-list"><div class="comment"><strong>Nicholas</strong><p>“Saya pulang dengan cara pandang baru: pemimpin tidak harus selalu menjadi orang pertama yang menjawab.”</p></div><div class="comment"><strong>Anna</strong><p>“Saya merasa sungguh didengarkan dan belajar membawa kegelisahan saya dalam doa.”</p></div><div class="comment"><strong>Maria</strong><p>“Ruang praktiknya membantu saya membawa kebiasaan mendengarkan ke komunitas.”</p></div></div></aside>
      </div>

      <EventResources v-if="sesi.length" :sesi="sesi" :is-en="isEn" :masuk="masuk" />
    </div>
  </main>
</template>
