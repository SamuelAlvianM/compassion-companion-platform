// middleware/admin.global.ts
// Penjaga area admin.
//
// Global (bukan dipasang per halaman) supaya halaman admin baru otomatis ikut
// terlindungi — tidak ada yang bisa lolos karena lupa menambahkan `middleware:`
// di definePageMeta.
//
// Middleware rute Nuxt juga berjalan saat SSR, jadi mengetik URL langsung di address
// bar sudah tertahan sebelum HTML dikirim. Ini BUKAN satu-satunya lapisan: setiap
// endpoint /api/admin/** memeriksa sendiri lewat wajibRole(), karena middleware
// halaman tidak melindungi API.

export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith('/admin')) return

  const { user, muat } = useAuth()
  if (!user.value) await muat()

  // Belum masuk -> ke halaman login, bawa tujuan semula supaya bisa dilanjutkan.
  if (!user.value) {
    return navigateTo({ path: '/id/login', query: { redirect: to.fullPath } })
  }

  // Sudah masuk tapi cuma peserta biasa (level 4). Area admin butuh level <= 3,
  // yaitu master (1), admin (2), atau editor (3).
  if (user.value.level > 3) {
    return navigateTo('/id/?akses=ditolak')
  }

  // Log kerja hanya untuk master. Ditegakkan di sini, bukan cuma dengan
  // menyembunyikan menunya: halaman yang dijaga hanya oleh menu yang tidak
  // digambar tetap bisa dibuka siapa pun yang mengetik alamatnya. Endpointnya
  // sendiri juga menolak (wajibRole 'master') — ini lapisan yang membuat
  // penolakannya terbaca sebagai halaman, bukan sebagai tabel yang gagal dimuat.
  if (to.path.startsWith('/admin/log') && user.value.level > 1) {
    return navigateTo('/admin?akses=ditolak')
  }
})
