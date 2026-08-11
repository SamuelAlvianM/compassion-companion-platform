// composables/useInfiniteList.ts
// Render bertahap untuk daftar panjang: yang tampil bertambah saat penanda di kaki
// daftar masuk viewport.
//
// Yang penting: ini **hanya memotong yang dirender**, bukan yang dicari. Sumbernya
// adalah daftar yang SUDAH tersaring, sehingga pencarian tetap menjangkau seluruh
// data meski baru sebagian yang pernah tergambar di layar. Kalau pemotongan
// dilakukan sebelum penyaringan, hasil pencarian akan bergantung pada seberapa jauh
// pengguna sempat menggulir — dan itu jenis bug yang sulit dipercaya saat dilaporkan.
//
// Dipakai bersama <div ref="sentinel"> di akhir daftar.

export const useInfiniteList = <T>(
  sumber: Ref<T[]> | ComputedRef<T[]>,
  opsi: { awal?: number, tambah?: number } = {},
) => {
  const awal = opsi.awal ?? 9
  const tambah = opsi.tambah ?? 6

  const terlihat = ref(awal)
  const sentinel = ref<HTMLElement | null>(null)

  const items = computed(() => sumber.value.slice(0, terlihat.value))
  const adaLagi = computed(() => terlihat.value < sumber.value.length)
  const sisa = computed(() => Math.max(0, sumber.value.length - terlihat.value))

  const muatLagi = () => {
    if (adaLagi.value) terlihat.value += tambah
  }

  // Filter berubah -> kembali ke halaman pertama. Tanpa ini, menyaring dari 40 ke
  // 3 hasil tetap menyisakan `terlihat` yang besar, dan penanda kaki daftar tidak
  // pernah terpicu lagi saat filter dilonggarkan.
  watch(() => sumber.value.length, () => { terlihat.value = awal })

  let pengamat: IntersectionObserver | undefined

  onMounted(() => {
    // IntersectionObserver dipakai alih-alih event scroll: ia tidak menyala tiap
    // piksel gulir, dan tetap benar saat daftar berada di dalam kontainer yang
    // punya gulirannya sendiri.
    pengamat = new IntersectionObserver(
      (masuk) => { if (masuk[0]?.isIntersecting) muatLagi() },
      // Dimuat sebelum penanda benar-benar terlihat, supaya tidak ada jeda kosong.
      { rootMargin: '300px' },
    )
    watch(sentinel, (el, lama) => {
      if (lama) pengamat?.unobserve(lama)
      if (el) pengamat?.observe(el)
    }, { immediate: true })
  })

  onBeforeUnmount(() => pengamat?.disconnect())

  return { items, sentinel, adaLagi, sisa, muatLagi, terlihat }
}
