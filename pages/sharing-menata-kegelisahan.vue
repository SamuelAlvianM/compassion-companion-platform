<script setup lang="ts">
const route = useRoute()
const isEn = computed(() => route.path.startsWith('/en'))

// Isi jurnal tetap dalam bahasa aslinya; hanya metadata yang mengikuti locale.
useSeoMeta({
  title: 'Membawa Kegelisahan kepada Tuhan',
  description: () => isEn.value
    ? 'Event reflection from Leadership with Compassion by Anna: recognising the state of your heart before stepping out to serve. (Written in Indonesian.)'
    : 'Refleksi peserta Leadership with Compassion oleh Anna: tentang mengenali keadaan hati dengan jujur sebelum melangkah untuk melayani.',
})
</script>

<template>
  <main class="event-page">
    <article class="container article">
      <div class="page-head">
        <nav class="breadcrumb"><NuxtLink to="/id/jurnal">Jurnal</NuxtLink><span>&rsaquo;</span><span>Detail</span></nav>
        <div class="eyebrow">Event Reflection · Leadership with Compassion</div>
        <h1>Membawa Kegelisahan kepada Tuhan</h1>
        <p>Refleksi tentang mengenali keadaan hati sebelum melangkah untuk melayani.</p>
      </div>
      <section class="article-body panel">
        <p>Hari itu saya sulit berkonsentrasi. Pikiran saya terus kembali ke pekerjaan yang belum selesai.</p>
        <p>Pada awalnya saya kesal karena merasa tidak mampu mengikuti doa dengan baik. Namun saya menyadari bahwa kegelisahan itu bukan gangguan yang harus saya singkirkan; ia adalah keadaan hati yang perlu saya bawa dengan jujur.</p>
        <h2>Melihat dengan belas kasih</h2>
        <p>Dalam keheningan, saya belajar tidak menghakimi diri sendiri. Saya dapat mengakui rasa lelah dan cemas, lalu menyerahkannya kepada Tuhan. Dari sana, saya mendapat ruang untuk bernapas dan kembali hadir bagi orang lain.</p>
        <p class="article-quote">&ldquo;Belas kasih dimulai ketika kita berani menerima keadaan hati sendiri.&rdquo;</p>
        <p>Pelayanan yang baik tidak harus dimulai dari hati yang sempurna, melainkan dari hati yang jujur dan terbuka.</p>
      </section>
      <section class="contributor panel"><div class="avatar">A</div><div><div class="eyebrow">Contributor</div><h3>Anna</h3><p class="muted">Peserta Leadership with Compassion.</p></div></section>
    </article>
  </main>
</template>
