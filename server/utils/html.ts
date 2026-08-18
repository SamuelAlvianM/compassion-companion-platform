// server/utils/html.ts
// Pembersih HTML untuk isi jurnal.
//
// Kenapa ada sama sekali: isi jurnal disimpan sebagai HTML dan digambar apa adanya
// dengan `v-html` di halaman publik. Tanpa penyaringan, siapa pun yang bisa menulis
// jurnal bisa menitipkan <script> yang jalan di peramban SETIAP pengunjung — termasuk
// mengambil cookie sesi admin yang sedang membaca. Editor Tiptap memang tidak
// menghasilkan tag semacam itu, tapi yang menentukan bukan editornya melainkan apa
// yang sampai ke endpoint: permintaan bisa dikirim langsung, tanpa lewat halaman.
//
// Disaring saat MENYIMPAN, bukan saat menggambar. Dua alasan: yang tersimpan di
// database jadi selalu aman dipakai ulang (RSS, ekspor, ringkasan), dan pekerjaannya
// dilakukan sekali per tulisan, bukan sekali per pembaca.

import sanitizeHtml from 'sanitize-html'

/**
 * Daftar putih, bukan daftar hitam.
 *
 * Isinya persis yang bisa dihasilkan toolbar editor: heading (h2–h4 saja — h1 milik
 * judul halaman), paragraf, penekanan, daftar bertingkat, kutipan, tautan, gambar,
 * garis pemisah, dan blok kode. Yang tidak ada di sini dibuang tanpa perlu
 * dipikirkan satu per satu — daftar hitam selalu ketinggalan satu tag.
 */
const ATURAN: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre',
    'h2', 'h3', 'h4',
    'ul', 'ol', 'li',
    'blockquote', 'hr',
    'a', 'img',
    // Gambar bertulisan keterangan, seperti gambar di skripsi. Node `gambarJurnal`
    // di editor menghasilkan bentuk ini.
    'figure', 'figcaption',
  ],

  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    // `data-align` menyimpan perataan (kiri/tengah/kanan) dan `style` lebarnya.
    // Keduanya harus lolos, kalau tidak gambar yang disusun rapi di editor akan
    // kembali rata kiri selebar penuh begitu tersimpan.
    figure: ['data-gambar', 'data-align', 'style'],
    // `start` dipertahankan supaya daftar bernomor yang sengaja dimulai dari angka
    // selain 1 tidak diam-diam kembali ke 1 sesudah disimpan.
    ol: ['start', 'type'],
  },

  // Skema tautan dibatasi: `javascript:` adalah cara paling tua menyelundupkan kode
  // lewat href, dan `data:` bisa membawa dokumen HTML utuh.
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https'] },

  // Satu-satunya gaya yang boleh lewat: lebar figure dalam persen. Daftar putih
  // sesempit ini disengaja — `style` adalah pintu masuk paling lebar untuk
  // merusak tata letak halaman publik dari dalam sebuah tulisan.
  allowedStyles: {
    figure: { width: [/^\d{1,3}%$/] },
  },

  // Semua tautan keluar dibuka di tab baru dan diputus dari halaman asalnya.
  // `noopener` bukan hiasan: tanpa itu halaman tujuan bisa mengarahkan ulang tab
  // yang membukanya lewat `window.opener`.
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }),
  },

  // Tag yang dibuang ikut membawa isinya HANYA untuk yang memang wadah kosong.
  // Bawaannya membuang isi <style> dan <script>; sisanya isinya dipertahankan
  // supaya tulisan tidak diam-diam kehilangan kalimat karena satu tag asing.
  nonTextTags: ['style', 'script', 'textarea', 'option', 'noscript'],
}

/**
 * Bersihkan HTML dari editor. `null`/kosong dikembalikan sebagai `null` supaya
 * kolom yang tidak diisi tidak tersimpan sebagai string kosong — keduanya berarti
 * sama bagi pembaca, tapi hanya salah satunya yang bisa diperiksa dengan `is null`.
 */
export const bersihkanHtml = (nilai: unknown): string | null => {
  if (typeof nilai !== 'string') return null
  const bersih = sanitizeHtml(nilai, ATURAN).trim()
  // Editor yang dikosongkan meninggalkan satu paragraf kosong; itu bukan isi.
  if (!bersih || bersih === '<p></p>' || bersih === '<p><br /></p>') return null
  return bersih
}

/**
 * Teks polos dari HTML — untuk ringkasan otomatis dan pencarian.
 *
 * Tagnya dibuang lewat sanitizer yang sama, bukan lewat regex `<[^>]*>`: regex
 * seperti itu tersandung pada atribut yang memuat tanda `>` dan justru bisa
 * menyisakan potongan tag.
 */
export const keTeks = (html: string | null | undefined): string => {
  if (!html) return ''
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, ' ')
    .trim()
}
