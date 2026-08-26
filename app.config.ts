// app.config.ts
// Pemetaan warna komponen Nuxt UI ke palet brand.
//
// Nama warna di sini merujuk ke ramp `--color-cc-*-50..950` yang didefinisikan di
// assets/css/tailwind.css. Nuxt UI membaca konfigurasi warna dari berkas ini, bukan
// dari nuxt.config.ts — `ui.colors` di nuxt.config akan diabaikan diam-diam.
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'cc-green',
      secondary: 'cc-brown',
      neutral: 'cc-stone',
    },

    /**
     * Judul modal: serif 16px, tanpa penebalan.
     *
     * Diatur SEKALI di sini, bukan lewat `:ui="{ title: … }"` di tiap UModal.
     * Modal tersebar di sebelas berkas — form peserta, form materi, unggah galeri,
     * pemotong gambar, pemutar video, konfirmasi status, panel pendaftaran — dan
     * menempelkan kelas yang sama di sebelas tempat berarti yang berikutnya dibuat
     * pasti terlewat, lalu satu modal berjudul lain sendiri di antara sepuluh.
     *
     * `font-normal` ditulis eksplisit: bawaan Nuxt UI `font-semibold`, dan serif
     * yang ditebalkan terbaca sebagai judul halaman, bukan judul kotak dialog.
     * Yang membedakannya dari teks di bawahnya cukup huruf serif dan warnanya.
     */
    modal: {
      slots: {
        title: 'font-serif text-base font-normal text-cc-green-800',
      },
    },

    /**
     * Judul slideover: lebih besar dari judul modal, disamakan dengan kepala kartu
     * (`font-serif text-2xl text-cc-green-800`).
     *
     * Ukurannya berbeda karena tempatnya berbeda. Modal duduk di atas halaman yang
     * digelapkan — judulnya cukup membedakan diri dari satu kalimat di bawahnya.
     * Slideover adalah panel setinggi layar dengan isinya sendiri, dan judul 16px di
     * puncaknya terbaca sebagai label, bukan kepala panel.
     *
     * Diatur di sini dengan alasan yang sama seperti modal: slideover dipakai di
     * dashboard dan di halaman statistik, dan salinan kelas yang sama di dua tempat
     * akan menyimpang begitu yang ketiga dibuat.
     */
    slideover: {
      slots: {
        title: 'font-serif text-2xl font-normal text-cc-green-800',
      },
    },

    /**
     * Tinggi daftar pilihan pada USelectMenu.
     *
     * Bawaan Nuxt UI mengunci `content` di `max-h-60` (240px). Kotak carinya duduk
     * DI LUAR area yang menggulir, jadi yang tersisa untuk daftarnya cuma 207px —
     * dan dengan baris setinggi 32px itu berarti **enam nama** yang terlihat.
     *
     * Enam terlalu sedikit untuk pemilih penulis dan peserta, yang daftarnya
     * seluruh akun aktif dan hanya akan bertambah panjang. Daftar yang memotong
     * dirinya pada nama keenam membuat orang mengira itulah seluruh isinya —
     * gulirannya ada, tapi tidak ada yang memberi tahu bahwa masih ada sisanya.
     *
     * `max-h-80` (320px) menyisakan 287px, yaitu **delapan** nama penuh dan
     * potongan yang kesembilan. Potongan itu disengaja: baris yang terpenggal di
     * tepi bawah adalah satu-satunya isyarat bahwa daftarnya masih berlanjut.
     *
     * Tidak dinaikkan lebih jauh karena pemilih ini duduk di tengah formulir;
     * daftar yang lebih tinggi dari itu mulai menabrak tepi layar laptop dan
     * dibalik posisinya oleh Reka UI, yang justru memindahkannya menjauh dari
     * kotak yang barusan diklik.
     *
     * Diatur di sini, bukan lewat `:ui` di tiap USelectMenu: komponennya dipakai di
     * empat tempat (event, penulis, editor, peserta), dan kelas yang sama disalin
     * empat kali adalah cara yang kelima nanti terlewat.
     */
    selectMenu: {
      slots: {
        content: 'max-h-80',
      },
    },
  },
})
