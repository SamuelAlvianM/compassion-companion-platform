<script setup lang="ts">
const route = useRoute()
const isEn = computed(() => route.path.startsWith('/en'))

// Isi jurnal tetap dalam bahasa aslinya; hanya metadata yang mengikuti locale.
useSeoMeta({
  title: 'Ketika Saya Belajar Mendengarkan',
  description: () => isEn.value
    ? 'Event reflection from Listening as Leadership by Nicholas: presence matters more than a quick answer. (Written in Indonesian.)'
    : 'Refleksi peserta Listening as Leadership oleh Nicholas: tentang kehadiran yang lebih berharga daripada jawaban cepat.',
})
</script>

<template>
  <main class="event-page">
    <article class="container article">
      <div class="page-head">
        <nav class="breadcrumb"><NuxtLink to="/id/jurnal">Jurnal</NuxtLink><span>&rsaquo;</span><span>Detail</span></nav>
        <div class="eyebrow">Event Reflection · Listening as Leadership</div>
        <h1>Ketika Saya Belajar Mendengarkan</h1>
        <p>Refleksi seorang peserta tentang kehadiran yang lebih berharga daripada jawaban cepat.</p>
      </div>
      <section class="article-body panel">
        <p>Saya datang dengan keyakinan bahwa seorang pemimpin harus selalu tahu apa yang harus dikatakan.</p>
        <p>Dalam sesi mendengarkan, kami diminta duduk berpasangan dan tidak terburu-buru memberi saran. Saya ingin menawarkan jalan keluar, tetapi teman saya hanya meminta ruang untuk bercerita.</p>
        <h2>Hadir sebelum memberi jawaban</h2>
        <p>Saya mulai memahami bahwa mendengarkan bukan sikap pasif. Ia membutuhkan perhatian, kesabaran, dan keberanian untuk tidak menjadikan pengalaman orang lain sebagai masalah yang harus segera saya selesaikan.</p>
        <p class="article-quote">&ldquo;Terkadang, kehadiran yang sungguh mendengarkan adalah bentuk kepemimpinan yang paling lembut.&rdquo;</p>
        <p>Sejak saat itu, saya ingin membawa cara hadir ini ke dalam keluarga, pekerjaan, dan komunitas saya.</p>
      </section>
      <section class="contributor panel"><div class="avatar">N</div><div><div class="eyebrow">Contributor</div><h3>Nicholas</h3><p class="muted">Peserta Listening as Leadership dan pegiat komunitas muda.</p></div></section>
    </article>
  </main>
</template>
