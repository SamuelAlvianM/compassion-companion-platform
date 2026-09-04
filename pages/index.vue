<script setup lang="ts">
const route = useRoute()
const isEn = computed(() => route.path.startsWith('/en'))
const langPath = (path: string) => `${isEn.value ? '/en' : '/id'}${path}`

// Reveal-saat-gulir. Elemen yang ikut ditandai `data-reveal="<nama kelompok>"` di
// markup di bawah; satu nilai atribut = satu rombongan yang bergerak berurutan,
// dan rombongannya baru mulai saat anggota pertamanya masuk viewport.
//
// Penandanya ditaruh di markup, bukan daftar selektor di composable, supaya
// menambah bagian baru di halaman ini cukup menulis satu atribut — tidak perlu
// membuka berkas kedua dan menjaga dua daftar tetap sinkron.
const beranda = ref<HTMLElement | null>(null)
useRevealGulir(beranda)
</script>
<template>
    <main ref="beranda">
        <section class="hero">
            <div class="container hero-copy">
                <h1 data-reveal="hero">Cultivating the<br>Compassionate Companion</h1>
                <p data-reveal="hero">An Ignatian Way of Accompanying Others in Today's Changing World</p>
                <div class="hero-actions" data-reveal="hero">
                    <NuxtLink :to="langPath('/events')" class="btn gold">{{ isEn ? 'Explore events' : 'Lihat Event' }}</NuxtLink><a
                        class="btn outline" href="#about">{{ isEn ? 'About us' : 'Tentang Kami' }}</a>
                </div>
            </div>
        </section>
        <section id="about" class="">
            <div class="intro-grid">
                <!-- Padding pindah dari `style=""` ke kelas `about-intro`.
                     Sebagai inline style ia `padding: 80px 180px` pada SEMUA lebar
                     layar, dan inline style tidak bisa ditimpa CSS tanpa
                     `!important` — di layar 375px, 180px kiri dan kanan menyisakan
                     15 piksel untuk teksnya, satu huruf per baris. -->
                <div class="section about-intro">
                    <div class="eyebrow" data-reveal="tentang">{{ isEn ? 'About us' : 'Tentang kami' }}</div>
                    <h2 class="section-title" data-reveal="tentang">{{ isEn ? 'A companion for the leadership journey.' : 'Rekan dalam perjalanan kepemimpinan' }}</h2>
                    <div class="about-copy" data-reveal="tentang">
                        <p>Kami adalah komunitas pembelajaran dan pendampingan yang berkomitmen mengembangkan kepemimpinan yang berakar pada Spiritualitas Ignasian dan nilai <em>Cura Personalis</em>; kepedulian terhadap pribadi secara utuh.</p>
                        <p>Komunitas ini lahir dari perpaduan pengalaman panjang dalam leadership coaching, pembinaan spiritual, keterlibatan aktif dalam Christian Life Community (CLC), serta kajian yang mengintegrasikan Spiritualitas Ignasian, Interpersonal Neurobiology (IPNB), dan compassion science.</p>
                        <p>Melalui berbagai program pembelajaran dan practicum, kami mendukung para pemimpin Gereja dan awam untuk mengembangkan kehadiran yang penuh belas kasih, sehingga mampu mendampingi dan melayani sesama dengan lebih bijaksana di tengah tantangan zaman.</p>
                    </div>
                </div>
                <div class="about-image-wrap" data-reveal="tentang-gambar">
                    <img src="/images/about-compassionate-companion.webp" alt="Compassionate Companion berjalan bersama">
                </div>
            </div>
        </section>
        <section class="section profile">
            <div class="container profile-grid"><NuxtImg src="/images/henk-profile.webp" alt="Henk T. Sengkey" data-reveal="profil"/>
                <div>
                    <div class="eyebrow" data-reveal="profil">Leadership coach & facilitator</div>
                    <h2 class="section-title" data-reveal="profil">Henk T. Sengkey</h2>
                    <p class="muted" data-reveal="profil">For more than ten years, Henk has accompanied leaders across various industries.
                        Combining knowledge, perspective, interpersonal skills, and deep integrity, he is a trusted
                        coach and facilitator.</p>
                    <p class="profile-note" data-reveal="profil">Stanford CCARE Ambassador of Compassion · Christian Life Community</p>
                </div>
            </div>
        </section>
        <section class="section programs-section">
            <div class="container">
                <div class="eyebrow" data-reveal="program">Bersama dalam komunitas</div>
                <h2 class="section-title" data-reveal="program">Program dan perjumpaan</h2>
                <div class="cards">
                    <article class="card" data-reveal="program">
                        <div class="card-image leadership-image"></div>
                        <div class="card-body">
                            <div class="event-meta">12 AGU · JAKARTA</div>
                            <h3>Leadership with Compassion</h3>
                            <p class="muted">Lokakarya satu hari untuk para utusan yang memimpin karya dan komunitas.
                            </p>
                            <NuxtLink :to="langPath('/events/leadership-with-compassion')" class="event-meta">DETAIL EVENT →</NuxtLink>
                        </div>
                    </article>
                    <article class="card" data-reveal="program">
                        <div class="card-image listening-image"></div>
                        <div class="card-body">
                            <div class="event-meta">TELAH BERLANGSUNG</div>
                            <h3>Listening as Leadership</h3>
                            <p class="muted">Refleksi dan praktik mendengarkan secara aktif dalam pelayanan.</p>
                            <NuxtLink :to="langPath('/events/listening-as-leadership')" class="event-meta">LIHAT DOKUMENTASI →
                            </NuxtLink>
                        </div>
                    </article>
                </div>
            </div>
        </section>
        <section v-if="false" id="insights" class="dark-band">
            <div class="container">
                <div class="journey">Let's walk this journey together.</div>
                <div class="eyebrow">Saling Berbagi</div>
                <h2 class="section-title">Perjalanan Spiritual Bersama.</h2><a href="https://wa.me/"
                    class="btn gold" target="_blank">◉ Hubungi Kami di WhatsApp</a>
            </div>
        </section>
        <section id="insights" class="insight-section"><div class="container"><div class="eyebrow" data-reveal="refleksi">Saling berbagi</div><h2 class="section-title" data-reveal="refleksi">Perjalanan Spiritual Bersama</h2><div class="insight-tagline" data-reveal="refleksi">let's walk this journey together</div><div class="reflection-cards"><article class="reflection-card" data-reveal="refleksi-kartu"><div class="quote-mark">“</div><h3>Nicholas</h3><div class="reflection-event">Peserta Listening as Leadership</div><div class="reflection-rule">✦</div><p>Selama doa, saya membayangkan sedang duduk bersama Yesus di bawah sebuah pohon. Tidak banyak percakapan yang terjadi. Saya hanya merasa didengarkan. Setelah selesai, saya menyadari bahwa saya ingin menjadi pemimpin yang lebih banyak mendengar daripada berbicara.</p></article><article class="reflection-card" data-reveal="refleksi-kartu"><div class="quote-mark">“</div><h3>Anonymous</h3><div class="reflection-event">Peserta Listening as Leadership</div><div class="reflection-rule">✦</div><p>Yang paling melekat bagi saya adalah Yesus tidak langsung memberi jawaban. Dalam doa, saya justru merasa sedang didengarkan. Itu membuat saya sadar bahwa selama ini saya sering terburu-buru mencari solusi, padahal saya hanya membutuhkan seseorang yang sungguh hadir.</p></article><article class="reflection-card" data-reveal="refleksi-kartu"><div class="quote-mark">“</div><h3>Anna</h3><div class="reflection-event">Peserta Leadership with Compassion</div><div class="reflection-rule">✦</div><p>Terus terang, saya sulit berkonsentrasi hari ini. Pikiran saya terus kembali ke pekerjaan yang belum selesai. Awalnya saya kesal, tapi akhirnya saya menyadari bahwa justru itulah keadaan hati saya hari ini. Saya membawa kegelisahan itu kepada Tuhan.</p></article></div></div></section>
    </main>
</template>
