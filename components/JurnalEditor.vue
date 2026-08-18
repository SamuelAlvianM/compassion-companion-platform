<script setup lang="ts">
// Editor isi jurnal: toolbar + area tulis + jalur masuk gambar.
//
// Dipakai dua layar yang berbeda penontonnya — halaman sunting admin dan halaman
// tulis member — supaya keduanya tidak pernah punya perkakas yang berbeda. Yang
// membedakan cuma prop `terkunci`.
//
// Tiga hal yang bentuknya sengaja begini:
//
//   1. TOOLBAR TANPA TULISAN, judul barisnya pun tidak ada. Tiga belas tombol
//      berlabel memenuhi dua baris dan terbaca sebagai kalimat, bukan perkakas;
//      namanya pindah ke tooltip.
//   2. TOOLBAR PUNYA BADAN SENDIRI — latar krem, garis bawah, dan sudut atas yang
//      menyatu dengan area tulis. Itu yang menandainya sebagai satu perangkat,
//      tanpa perlu ditulisi namanya.
//   3. AREA TULIS BUKAN PUTIH POLOS. Ia dibingkai, diberi ruang tepi seperti
//      halaman kertas, dan tingginya minimal 320px — supaya jelas di mana batas
//      tempat mengetik, bahkan saat isinya masih kosong.

const isi = defineModel<string>({ default: '' })

const props = withDefaults(defineProps<{
  /** Dikunci: isinya tetap tergambar utuh, tapi tidak bisa diubah. Dipakai saat
      tulisan sedang diperiksa orang lain, dan saat editor membuka jurnal yang
      bukan tugasnya. */
  terkunci?: boolean
  placeholder?: string
}>(), {
  terkunci: false,
  placeholder: 'Mulai menulis di sini…',
})

const toast = useToast()
const galatUnggah = ref('')
const sedangUnggah = ref(false)

/**
 * Susunan toolbar. Dikelompokkan menurut apa yang dikerjakannya, dan tiap kelompok
 * dipisah garis di layar: penekanan, bentuk paragraf, daftar, sisipan, riwayat.
 *
 * `kind` adalah nama handler bawaan Nuxt UI (lihat runtime/utils/editor.js);
 * `tooltip` yang membuat namanya tetap bisa dibaca meski tombolnya tinggal ikon.
 */
const alat = computed(() => [
  [
    { kind: 'mark', mark: 'bold', icon: 'i-lucide-bold', tooltip: { text: 'Tebal' }, ariaLabel: 'Tebal' },
    { kind: 'mark', mark: 'italic', icon: 'i-lucide-italic', tooltip: { text: 'Miring' }, ariaLabel: 'Miring' },
    { kind: 'mark', mark: 'underline', icon: 'i-lucide-underline', tooltip: { text: 'Garis bawah' }, ariaLabel: 'Garis bawah' },
  ],
  [
    { kind: 'heading', level: 2, icon: 'i-lucide-heading-2', tooltip: { text: 'Judul bagian' }, ariaLabel: 'Judul bagian' },
    { kind: 'heading', level: 3, icon: 'i-lucide-heading-3', tooltip: { text: 'Sub-judul' }, ariaLabel: 'Sub-judul' },
    { kind: 'paragraph', icon: 'i-lucide-pilcrow', tooltip: { text: 'Paragraf biasa' }, ariaLabel: 'Paragraf biasa' },
  ],
  [
    { kind: 'bulletList', icon: 'i-lucide-list', tooltip: { text: 'Daftar bertitik' }, ariaLabel: 'Daftar bertitik' },
    {
      kind: 'orderedList',
      icon: 'i-lucide-list-ordered',
      tooltip: { text: 'Daftar bernomor — Tab untuk membuat anak daftar (a, b, c)' },
      ariaLabel: 'Daftar bernomor',
    },
    { kind: 'blockquote', icon: 'i-lucide-quote', tooltip: { text: 'Kutipan' }, ariaLabel: 'Kutipan' },
  ],
  [
    { kind: 'link', icon: 'i-lucide-link', tooltip: { text: 'Tautan' }, ariaLabel: 'Tautan' },
    {
      icon: 'i-lucide-image',
      tooltip: { text: 'Sisipkan gambar — bisa juga diseret atau ditempel langsung' },
      ariaLabel: 'Sisipkan gambar',
      onClick: () => pilihBerkas(),
    },
    { kind: 'horizontalRule', icon: 'i-lucide-minus', tooltip: { text: 'Garis pemisah' }, ariaLabel: 'Garis pemisah' },
  ],
  [
    { kind: 'undo', icon: 'i-lucide-undo-2', tooltip: { text: 'Batalkan' }, ariaLabel: 'Batalkan' },
    { kind: 'redo', icon: 'i-lucide-redo-2', tooltip: { text: 'Ulangi' }, ariaLabel: 'Ulangi' },
  ],
])

// ── Gambar masuk ─────────────────────────────────────────────────────────────
// Tiga jalan, satu tujuan: tombol, seret-lepas, dan tempel. Ketiganya berakhir di
// `unggahLaluSisip()`, jadi tidak ada jalan masuk yang menghasilkan bentuk berbeda.
const editorRef = ref<any>(null)
const inputBerkas = ref<HTMLInputElement | null>(null)

const pilihBerkas = () => {
  if (props.terkunci) return
  inputBerkas.value?.click()
}

const dariInput = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const berkas = input.files?.[0]
  input.value = ''
  if (berkas) await unggahLaluSisip(berkas)
}

const unggahLaluSisip = async (berkas: File) => {
  if (props.terkunci) return
  if (!berkas.type.startsWith('image/')) {
    galatUnggah.value = 'Yang bisa disisipkan ke tulisan hanya berkas gambar.'
    return
  }

  galatUnggah.value = ''
  sedangUnggah.value = true
  try {
    // Lewat pustaka media yang sama dengan sampul event dan galeri: gambar di
    // dalam tulisan tetap berkas milik komunitas ini, bukan tempelan base64 yang
    // menggelembungkan baris database tiap kali tulisannya disimpan.
    const media = await unggahMedia(berkas, { hanyaKind: 'gambar' })
    editorRef.value?.editor?.chain().focus().sisipGambarJurnal({
      src: media.publicUrl,
      alt: media.originalName,
    }).run()
  }
  catch (e: any) {
    galatUnggah.value = e?.data?.statusMessage || e?.message || 'Gambar gagal diunggah.'
  }
  finally {
    sedangUnggah.value = false
  }
}

/**
 * Menempel dan menyeret gambar.
 *
 * `handlePaste` juga menangkap gambar yang disalin dari situs lain — peramban
 * menyertakannya sebagai berkas di clipboard. Yang TIDAK ditangkap: tempelan yang
 * cuma berisi <img src="https://situs-lain/..."> tanpa berkas; gambar seperti itu
 * akan hilang begitu situs asalnya mengubah alamatnya, jadi yang masuk ke tulisan
 * hanya yang benar-benar terunggah ke pustaka sendiri.
 */
const editorProps = computed(() => ({
  handlePaste: (_view: any, event: ClipboardEvent) => {
    if (props.terkunci) return false
    const berkas = [...(event.clipboardData?.files ?? [])].find(f => f.type.startsWith('image/'))
    if (!berkas) return false
    event.preventDefault()
    unggahLaluSisip(berkas)
    return true
  },
  handleDrop: (_view: any, event: DragEvent) => {
    if (props.terkunci) return false
    const berkas = [...(event.dataTransfer?.files ?? [])].find(f => f.type.startsWith('image/'))
    if (!berkas) return false
    event.preventDefault()
    unggahLaluSisip(berkas)
    return true
  },
}))

// Node gambar sendiri ditambahkan ke StarterKit bawaan Nuxt UI. Image bawaan
// dimatikan lewat prop `:image="false"` di bawah — kalau dua-duanya hidup,
// tempelan gambar bisa jatuh ke node yang tidak punya keterangan dan perataan.
//
// `.configure()` mengembalikan SALINAN baru dari node ini, jadi tiap komponen
// membawa ekstensinya sendiri alih-alih berbagi satu tetapan di lingkup modul.
// Halaman sunting memuat dua editor sekaligus (tab Indonesia dan English,
// dua-duanya `v-show` sehingga benar-benar ter-mount), dan satu instance yang
// dipakai bersama membuat keduanya saling menimpa keadaan.
//
// Ini BUKAN yang menyembuhkan "Adding different instances of a keyed plugin
// (plugin$)" — sempat dikira begitu. Sebab galat itu ada di luar berkas ini,
// yaitu dua salinan modul `prosemirror-state` di graf Vite; obatnya di
// `vite.optimizeDeps` pada nuxt.config.ts.
const ekstensi = computed(() => [GambarJurnal.configure()])

watch(galatUnggah, (pesan) => {
  if (pesan) toast.add({ title: pesan, icon: 'i-lucide-triangle-alert', color: 'error' })
})
</script>

<template>
  <div class="jurnal-editor-bingkai" :class="terkunci ? 'is-terkunci' : ''">
    <UEditor
      ref="editorRef"
      v-model="isi"
      content-type="html"
      :editable="!terkunci"
      :image="false"
      :mention="false"
      :placeholder="placeholder"
      :editor-props="editorProps"
      :extensions="ekstensi"
      :ui="{
        root: 'jurnal-editor',
        content: 'jurnal-editor-isi',
      }"
    >
      <template #default="{ editor }">
        <!-- Kepala perkakas. Barisnya diberi nama supaya deretan ikon ini terbaca
             sebagai satu perangkat, bukan hiasan yang kebetulan ada di atas. -->
        <!-- Tanpa judul baris. Latar krem + garis bawahnya sudah cukup menandai
             bahwa deretan ikon ini satu perangkat; menamainya lagi dengan tulisan
             cuma menambah baris yang dibaca sekali lalu diabaikan selamanya. -->
        <div v-if="!terkunci" class="jurnal-editor-kepala">
          <div class="jurnal-editor-baris">
            <UEditorToolbar :editor="editor" :items="alat" class="jurnal-editor-alat" />

            <span v-if="sedangUnggah" class="jurnal-editor-kabar">
              <UIcon name="i-lucide-loader-circle" class="size-3.5 animate-spin" />
              Mengunggah gambar…
            </span>
          </div>
        </div>

        <!-- Keadaan terkunci tetap dikatakan: formulir yang diam-diam tidak bisa
             diketik terbaca sebagai halaman rusak, bukan sebagai aturan. -->
        <div v-else class="jurnal-editor-kepala">
          <div class="jurnal-editor-baris jurnal-editor-kabar">
            <UIcon name="i-lucide-lock" class="size-3.5" />
            <span>Hanya bisa dibaca</span>
          </div>
        </div>
      </template>
    </UEditor>

    <input ref="inputBerkas" type="file" accept="image/*" class="hidden" @change="dariInput">
  </div>
</template>

<style>
/* ── Bingkai ────────────────────────────────────────────────────────────────
   Toolbar dan area tulis dibuat menyatu sebagai satu kotak: toolbar jadi kepala
   berlatar krem, area tulis jadi badan putih di bawahnya. */
.jurnal-editor-bingkai .jurnal-editor {
  border: 1px solid var(--color-cc-stone-300);
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
}

.jurnal-editor-kepala {
  background: var(--color-cc-stone-50, #fbf4eb);
  border-bottom: 1px solid var(--color-cc-stone-200);
}

.jurnal-editor-baris {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
}

.jurnal-editor-alat {
  flex: 1;
  min-width: 0;
}

.jurnal-editor-kabar {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: none;
  font-size: 12px;
  color: var(--color-cc-brown-600, #92704d);
}

/* ── Area tulis ─────────────────────────────────────────────────────────────
   Ruang tepi selebar halaman kertas, tinggi minimal supaya kotaknya sudah terbaca
   sebagai tempat menulis meski isinya belum ada, dan garis putus-putus tipis di
   tepi dalam sebagai penanda batas area. */
.jurnal-editor-isi {
  min-height: 320px;
  padding: 22px 26px 30px;
  font-size: 16px;
  line-height: 1.7;
}

.jurnal-editor-isi .tiptap {
  min-height: 268px;
  outline: none;
}

.jurnal-editor-bingkai.is-terkunci .jurnal-editor {
  background: var(--color-cc-stone-50, #fbf4eb);
}

/* Tulisan di dalam editor digambar seperti di halaman publik — ukuran judul,
   kutipan, dan daftar yang sama. Yang dilihat penulis harus yang akan dibaca
   pembacanya. */
.jurnal-editor-isi h2 { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 30px; margin: 26px 0 8px; color: var(--color-primary); }
.jurnal-editor-isi h3 { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 24px; margin: 22px 0 6px; color: var(--color-primary); }
.jurnal-editor-isi p { margin: 0 0 12px; }
.jurnal-editor-isi blockquote {
  margin: 18px 0;
  padding: 12px 18px;
  border-left: 4px solid var(--color-accent);
  background: var(--color-surface-alt);
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 22px;
  line-height: 1.3;
}
.jurnal-editor-isi a { color: var(--color-secondary); text-decoration: underline; text-underline-offset: 3px; }
.jurnal-editor-isi hr { margin: 24px 0; border: 0; border-top: 1px solid var(--color-line); }

/* Daftar bertingkat: 1. lalu a. b. c. lalu i. ii. iii.
   Tab menurunkan tingkat, Shift+Tab menaikkannya — itu bawaan Tiptap. Yang perlu
   diatur cuma penomorannya, karena anak yang kembali bernomor angka terbaca
   sebagai daftar baru yang tidak berhubungan dengan induknya. Aturan yang sama ada
   di halaman publik (lihat `.article-body` di assets/css/main.css). */
.jurnal-editor-isi ul,
.jurnal-editor-isi ol { margin: 12px 0; padding-left: 26px; }
.jurnal-editor-isi ol { list-style: decimal; }
.jurnal-editor-isi ol ol { list-style: lower-alpha; }
.jurnal-editor-isi ol ol ol { list-style: lower-roman; }
.jurnal-editor-isi ul { list-style: disc; }
.jurnal-editor-isi ul ul { list-style: circle; }
.jurnal-editor-isi li { margin: 4px 0; }
.jurnal-editor-isi li > p { margin: 0; }

/* Teks bayangan saat kosong — bagian dari "ini area tulis": kotak kosong tanpa
   satu pun kata tidak memberi tahu apa yang diharapkan darinya. */
.jurnal-editor-isi .tiptap p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
  color: var(--color-cc-stone-400);
}
</style>
