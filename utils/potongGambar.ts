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
 * Jenis keluaran mengikuti jenis masukan untuk PNG dan WebP, dan jatuh ke JPEG
 * untuk sisanya (termasuk HEIC yang sudah didekode browser).
 *
 * PNG dipertahankan bukan karena mutunya: ia satu-satunya di antara ketiganya yang
 * menyimpan transparansi. Memaksanya jadi JPEG akan mengubah latar tembus pandang
 * menjadi hitam pekat — dan itu baru terlihat setelah fotonya terbit.
 */
const jenisKeluaran = (mimeAsal: string) =>
  mimeAsal === 'image/png' || mimeAsal === 'image/webp' ? mimeAsal : 'image/jpeg'

const gantiEkstensi = (nama: string, mime: string) => {
  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg'
  return `${nama.replace(/\.[^./\\]+$/, '')}.${ext}`
}

/**
 * Terapkan putaran & potongan, kembalikan `File` baru yang siap diunggah.
 *
 * Berkas aslinya dikembalikan apa adanya kalau tidak ada yang berubah — melewatkan
 * canvas berarti melewatkan pula pengodean ulang, yang untuk JPEG selalu menurunkan
 * mutu meski gambarnya sama persis.
 */
export const potongGambar = async (
  berkas: File,
  sumber: string,
  p: PotonganGambar,
): Promise<File> => {
  if (!p.natural || !adaPotongan(p)) return berkas

  const img = await muatGambar(sumber)
  const { w: nw, h: nh } = p.natural

  const lebar = Math.max(1, Math.round(p.crop.w))
  const tinggi = Math.max(1, Math.round(p.crop.h))

  const canvas = document.createElement('canvas')
  canvas.width = lebar
  canvas.height = tinggi
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas tidak tersedia di peramban ini.')

  const mime = jenisKeluaran(berkas.type)
  // JPEG tidak punya alpha; tanpa latar putih, area transparan jadi hitam.
  if (mime === 'image/jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, lebar, tinggi)
  }

  // Pindahkan titik asal ke sudut kiri-atas potongan, lalu gambar seluruh foto
  // ke dalam ruang yang sudah diputar. Urutannya penting: menggeser dulu baru
  // memutar akan menggeser sepanjang sumbu yang ikut miring.
  ctx.translate(-Math.round(p.crop.x), -Math.round(p.crop.y))

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
    canvas.toBlob(selesai, mime, 0.92))
  if (!blob) throw new Error('Gagal menyusun gambar hasil potongan.')

  return new File([blob], gantiEkstensi(berkas.name, mime), { type: mime })
}
