// utils/potongGambar.ts
// Model data pemotongan gambar + eksekutornya di atas <canvas>.
//
// KEPUTUSAN POKOK: potongan disimpan dalam **piksel sumber setelah diputar**, bukan
// dalam koordinat layar.
//
// Percobaan pertama menyimpan transform tampilan (geser, skala, putar) lalu
// menghitung ulang potongannya dari ukuran panggung saat diekspor. Itu berarti
// hasil potongan bergantung pada seberapa lebar jendela browser saat tombol ditekan:
// panggung yang lebih sempit menghasilkan berkas yang lebih kecil, dan potongan yang
// disimpan tidak bisa diperlihatkan ulang di layar berukuran lain.
//
// Dengan koordinat sumber, zoom dan geser murni jadi alat lihat — mengubahnya tidak
// mengubah hasil sama sekali — dan berkas keluarannya selalu setajam aslinya.

export interface PotonganGambar {
  /** Kelipatan 90 derajat, searah jarum jam. */
  putaran: 0 | 90 | 180 | 270
  /** Kotak potong dalam piksel sumber SETELAH diputar. */
  crop: { x: number, y: number, w: number, h: number }
  /** Ukuran asli berkas; diisi editor setelah gambarnya termuat. */
  natural: { w: number, h: number } | null
  /** Hanya alat lihat — tidak ikut menentukan hasil. */
  zoom: number
  panX: number
  panY: number
  /** Rasio yang sedang dikunci; null berarti bebas. */
  rasio: number | null
}

export const potonganBaru = (): PotonganGambar => ({
  putaran: 0,
  crop: { x: 0, y: 0, w: 0, h: 0 },
  natural: null,
  zoom: 1,
  panX: 0,
  panY: 0,
  rasio: null,
})

/** Ukuran gambar setelah diputar — 90°/270° menukar sisi-sisinya. */
export const ukuranTerputar = (natural: { w: number, h: number }, putaran: number) =>
  putaran === 90 || putaran === 270 ? { w: natural.h, h: natural.w } : { w: natural.w, h: natural.h }

/** Sudahkah potongannya benar-benar memotong sesuatu? */
export const adaPotongan = (p: PotonganGambar) => {
  if (!p.natural) return false
  const penuh = ukuranTerputar(p.natural, p.putaran)
  return p.putaran !== 0
    || Math.round(p.crop.x) > 0 || Math.round(p.crop.y) > 0
    || Math.round(p.crop.w) < penuh.w - 1 || Math.round(p.crop.h) < penuh.h - 1
}

const muatGambar = (sumber: string) => new Promise<HTMLImageElement>((selesai, gagal) => {
  const img = new Image()
  img.onload = () => selesai(img)
  img.onerror = () => gagal(new Error('Gambar tidak bisa dibaca.'))
  img.src = sumber
})

/**
 * SEMUA gambar keluar sebagai WebP.
 *
 * Sebelumnya jenis masukan dipertahankan untuk PNG, dengan alasan transparansi:
 * JPEG tidak punya alpha, jadi latar tembus pandang akan menjadi hitam pekat.
 * Alasannya benar, penggantinya yang salah — WebP menyimpan alpha JUGA, sekaligus
 * memampatkan foto sebaik JPEG.
 *
 * Aturan lama itu mahal. Satu foto yang kebetulan disimpan sebagai PNG tetap PNG
 * sampai ke pengunjung: 2,7 MB untuk gambar yang sebagai WebP cukup 150 KB. Di
 * produksi itu terjadi pada hampir setiap sampul event, dan itulah yang membuat
 * halaman terasa lambat padahal servernya menjawab dalam 20 milidetik.
 */
const MIME_KELUARAN = 'image/webp'

/**
 * Sisi terpanjang yang diizinkan.
 *
 * 1920 px cukup untuk sampul selebar layar bahkan pada layar kerapatan ganda,
 * sementara foto ponsel 4000 px yang diunggah apa adanya menghabiskan empat kali
 * lebih banyak byte untuk piksel yang tidak pernah tergambar.
 */
export const SISI_MAKS = 1920

/** Mutu WebP: 0,82 adalah titik di mana selisihnya sudah tidak terlihat mata pada
    foto, tapi berkasnya masih jauh lebih kecil daripada di 0,95. */
const MUTU = 0.82

const gantiEkstensi = (nama: string) => `${nama.replace(/\.[^./\\]+$/, '')}.webp`

/** Faktor pengecilan supaya sisi terpanjang tidak melewati SISI_MAKS. */
const faktorSusut = (lebar: number, tinggi: number) =>
  Math.min(1, SISI_MAKS / Math.max(lebar, tinggi))

/**
 * Terapkan putaran & potongan, lalu kecilkan dan kodekan ulang ke WebP.
 *
 * Berkas aslinya TIDAK lagi dikembalikan apa adanya saat tidak ada potongan.
 * Dulu begitu, dengan alasan pengodean ulang JPEG selalu menurunkan mutu sedikit —
 * benar, tapi harganya adalah foto ponsel 8 MB yang naik utuh ke pustaka media lalu
 * diunduh utuh oleh setiap pengunjung. Yang dilewati sekarang hanya berkas yang
 * memang sudah kecil dan sudah WebP; sisanya selalu lewat canvas.
 */
export const potongGambar = async (
  berkas: File,
  sumber: string,
  p: PotonganGambar,
): Promise<File> => {
  if (!p.natural) return berkas

  const penuh = ukuranTerputar(p.natural, p.putaran)
  const memotong = adaPotongan(p)

  // Ukuran keluaran sebelum dikecilkan: kotak potong bila memotong, gambar utuh
  // bila tidak.
  const sumberLebar = memotong ? Math.max(1, Math.round(p.crop.w)) : penuh.w
  const sumberTinggi = memotong ? Math.max(1, Math.round(p.crop.h)) : penuh.h

  const susut = faktorSusut(sumberLebar, sumberTinggi)
  const sudahRingkas = berkas.type === MIME_KELUARAN && susut === 1

  // Tidak memotong, tidak perlu dikecilkan, dan sudah WebP — tidak ada yang bisa
  // diperbaiki dengan menggambar ulang.
  if (!memotong && sudahRingkas) return berkas

  const img = await muatGambar(sumber)
  const { w: nw, h: nh } = p.natural

  const lebar = Math.max(1, Math.round(sumberLebar * susut))
  const tinggi = Math.max(1, Math.round(sumberTinggi * susut))

  const canvas = document.createElement('canvas')
  canvas.width = lebar
  canvas.height = tinggi
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas tidak tersedia di peramban ini.')

  // Penghalusan mutu tinggi hanya berarti saat gambarnya diperkecil — dan di situ
  // ia yang membedakan hasil yang tajam dari hasil yang bergerigi.
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  // Pengecilan dikerjakan oleh matriks, bukan oleh ukuran kanvas: dengan begitu
  // seluruh perhitungan potongan & putaran di bawah tetap dalam piksel sumber,
  // persis seperti saat potongannya disimpan.
  if (susut !== 1) ctx.scale(susut, susut)

  // Pindahkan titik asal ke sudut kiri-atas potongan, lalu gambar seluruh foto
  // ke dalam ruang yang sudah diputar. Urutannya penting: menggeser dulu baru
  // memutar akan menggeser sepanjang sumbu yang ikut miring.
  if (memotong) ctx.translate(-Math.round(p.crop.x), -Math.round(p.crop.y))

  switch (p.putaran) {
    case 90:
      ctx.translate(nh, 0)
      ctx.rotate(Math.PI / 2)
      break
    case 180:
      ctx.translate(nw, nh)
      ctx.rotate(Math.PI)
      break
    case 270:
      ctx.translate(0, nw)
      ctx.rotate(-Math.PI / 2)
      break
  }

  ctx.drawImage(img, 0, 0)

  const blob = await new Promise<Blob | null>(selesai =>
    canvas.toBlob(selesai, MIME_KELUARAN, MUTU))
  if (!blob) throw new Error('Gagal menyusun gambar hasil potongan.')

  return new File([blob], gantiEkstensi(berkas.name), { type: MIME_KELUARAN })
}