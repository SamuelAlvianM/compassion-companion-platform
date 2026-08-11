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
  },
})
