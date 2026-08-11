<script setup lang="ts">
const route = useRoute()
const isEn = computed(() => route.path.startsWith('/en'))

// Isi jurnal tetap dalam bahasa aslinya; hanya metadata yang mengikuti locale.
useSeoMeta({
  title: 'Menemukan Arah dalam Kebersamaan',
  description: () => isEn.value
    ? 'Sharing Journey by Imanuel Ananta: how a reflective journey changed the way he sees himself, others, and the call to serve. (Written in Indonesian.)'
    : 'Sharing Journey oleh Imanuel Ananta: ketika sebuah perjalanan refleksi mengubah cara kita melihat diri sendiri, sesama, dan panggilan untuk melayani.',
})
</script>

<template>
  <main class="event-page">
    <article class="container article">
      <div class="page-head">
        <nav class="breadcrumb"><NuxtLink to="/id/jurnal">Jurnal</NuxtLink><span>&rsaquo;</span><span>Detail</span></nav>
        <div class="eyebrow">Sharing Journey</div>
        <h1>Menemukan Arah dalam Kebersamaan</h1>
        <p>Ketika sebuah perjalanan refleksi mengubah cara kita melihat diri sendiri, sesama, dan panggilan untuk melayani.</p>
      </div>
      <section class="article-body panel">
        <p>Ada masa ketika pertanyaan &ldquo;siapa saya?&rdquo; terasa sederhana, tetapi jawabannya justru membawa kita pada perjalanan yang panjang.</p>
        <p>Dalam sebuah rekoleksi, seorang peserta muda menemukan bahwa mengenal diri bukanlah proses yang dilakukan sendirian. Melalui sesi refleksi, kerja kelompok, dan percakapan jujur, ia belajar memberi ruang bagi pertanyaan yang selama ini disimpan: untuk apa saya hadir, dan bagaimana saya dapat berarti bagi sesama?</p>
        <h2>Belajar untuk percaya</h2>
        <p>Kegiatan bersama membuka pengalaman baru. Kerja sama mengajarkan bahwa tidak semua persoalan harus dipikul seorang diri; meminta bantuan dan memberi kepercayaan dapat menjadi wujud keberanian. Kebersamaan bukan sekadar hadir di tempat yang sama, melainkan kesediaan untuk saling menopang.</p>
        <p class="article-quote">&ldquo;Kita bertumbuh ketika berani mengenal diri, membuka hati, dan melangkah bersama.&rdquo;</p>
        <h2>Panggilan yang menjadi nyata</h2>
        <p>Dari hening, doa, dan refleksi, muncul kesadaran sederhana: hidup menemukan arah ketika dipakai untuk melayani. Kesadaran ini tidak menghapus semua keraguan, tetapi memberi langkah pertama yang lebih jernih untuk membawa kasih, persaudaraan, dan kepemimpinan ke dalam keseharian.</p>
      </section>
      <section class="contributor panel"><div class="avatar">IA</div><div><div class="eyebrow">Contributor</div><h3>Imanuel Ananta</h3><p class="muted">Mahasiswa dan pegiat komunitas muda. Menulis tentang pertumbuhan pribadi, kebersamaan, dan semangat melayani.</p></div></section>
    </article>
  </main>
</template>
