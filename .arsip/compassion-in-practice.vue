<script setup lang="ts">
const route = useRoute()
const sent = ref(false)
const form = reactive({ nama: '', whatsapp: '', email: '' })
const eventsPath = computed(() => route.path.startsWith('/en') ? '/en/events' : '/id/events')
const isEn = computed(() => route.path.startsWith('/en'))

useSeoMeta({
  title: 'Compassion in Practice',
  description: () => isEn.value
    ? 'An ongoing series of learning sessions and practicums in compassionate leadership, with materials and documentation for participants.'
    : 'Rangkaian pembelajaran dan practicum kepemimpinan penuh belas kasih yang sedang berlangsung, lengkap dengan materi dan dokumentasi bagi peserta.',
})


// Sesi & materi dari database. Aturan aksesnya ditegakkan di server:
// materi hanya terkirim lengkap bagi peserta event dan pengelola level <= 3.
const { data: sesiData } = await useFetch('/api/events/compassion-in-practice/sesi')
const sesi = computed(() => sesiData.value?.data ?? [])
const masuk = computed(() => Boolean(sesiData.value?.meta.masuk))
</script>

<template>
  <main class="event-page">
    <div class="container">
      <div class="page-head"><nav class="breadcrumb"><NuxtLink :to="eventsPath">Events</NuxtLink><span>›</span><span>Berlangsung</span></nav><div class="eyebrow">Berlangsung - Online via Zoom</div><h1>Compassion in Practice</h1><p>Rangkaian pembelajaran dan practicum untuk membawa belas kasih ke dalam kepemimpinan sehari-hari.</p></div>
      <div class="event-detail-grid">
        <section class="event-overview"><img src="/images/listening-as-leadership.png" alt="Compassion in Practice"><div class="event-information panel"><div class="eyebrow">Informasi acara</div><dl><div><dt>Periode</dt><dd>4-25 September 2026</dd></div><div><dt>Waktu</dt><dd>19.00-21.00 WIB</dd></div><div><dt>Lokasi</dt><dd>Online via Zoom</dd></div></dl><h2>Mempraktikkan belas kasih dalam karya.</h2><p class="muted">Program berjalan dalam beberapa sesi. Peserta dapat mengikuti materi, recording, serta kegiatan practicum sesuai jadwal.</p></div></section>
        <section class="registration panel">
          <div class="eyebrow">Pendaftaran tanpa akun</div>
          <h2 class="section-title">Mari bergabung.</h2>
          <p class="muted">Admin akan menghubungi Anda untuk informasi pembayaran dan koordinasi acara.</p>
          <UForm :state="form" class="mt-5 space-y-4" @submit="sent = true">
            <UFormField label="Nama lengkap" name="nama" required>
              <UInput v-model="form.nama" placeholder="Nama Anda" required class="w-full" />
            </UFormField>
            <UFormField label="Nomor WhatsApp" name="whatsapp" required>
              <UInput v-model="form.whatsapp" placeholder="08xx xxxx xxxx" required class="w-full" />
            </UFormField>
            <UFormField label="Email" name="email" required>
              <UInput v-model="form.email" type="email" placeholder="nama@email.com" required class="w-full" />
            </UFormField>
            <UButton type="submit" color="secondary" size="lg" block>Kirim pendaftaran</UButton>
          </UForm>
          <UAlert
            v-if="sent"
            class="mt-4"
            color="primary"
            variant="subtle"
            icon="i-lucide-check"
            title="Pendaftaran diterima"
            description="Admin akan segera menghubungi Anda."
          />
        </section>
      </div>

      <EventResources v-if="sesi.length" :sesi="sesi" :is-en="isEn" :masuk="masuk" />
    </div>
  </main>
</template>
