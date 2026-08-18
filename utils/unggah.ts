// utils/unggah.ts
// Unggah satu berkas ke /api/media/upload, dengan laporan kemajuan.
//
// KENAPA XMLHttpRequest, bukan $fetch. `fetch` tidak punya cara melaporkan berapa
// banyak yang sudah terkirim — `ReadableStream` untuk request body ada di spesifikasi
// tapi belum bisa diandalkan lintas peramban, dan tanpa itu satu-satunya kabar yang
// tersedia adalah "selesai" atau "gagal". Untuk gambar 200 KB itu cukup; untuk
// rekaman sesi 80 MB itu berarti beberapa menit tanpa satu pun tanda bahwa sesuatu
// sedang terjadi, dan yang menunggu akan menekan tombolnya lagi.
//
// XHR sudah lama dianggap peninggalan, tapi `upload.onprogress` tidak punya pengganti
// yang setara. Yang dibungkus di sini cuma satu permintaan; sisanya tetap $fetch.

export interface HasilUnggah {
  id: string
  publicUrl: string
  originalName: string
  mimeType: string
  fileSize: number
}

export interface OpsiUnggah {
  /** Batasi jenis di server, mis. 'gambar'. */
  hanyaKind?: string
  altText?: string
  /**
   * Dipanggil dengan 0–100.
   *
   * 100 berarti **byte terakhir sudah berangkat**, bukan berkasnya sudah tersimpan.
   * Sesudah itu masih ada jeda: server menguraikan multipart dan menulis blobnya ke
   * database, dan pada video puluhan MB jeda itu bisa belasan detik. Pemakai wajib
   * membedakan keduanya di layar — lihat catatan di bawah.
   */
  onProgres?: (persen: number) => void
}

export const unggahMedia = (berkas: File, opsi: OpsiUnggah = {}) =>
  new Promise<HasilUnggah>((resolve, reject) => {
    const fd = new FormData()
    fd.append('file', berkas)
    if (opsi.hanyaKind) fd.append('hanyaKind', opsi.hanyaKind)
    if (opsi.altText) fd.append('altText', opsi.altText)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/media/upload')
    xhr.responseType = 'json'

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return
      // 100 DILAPORKAN, tidak ditahan di 99.
      //
      // Versi pertama menahannya, dengan maksud "jangan bilang selesai sebelum
      // server menjawab". Hasilnya justru lebih buruk: bar berhenti di 99% lalu diam
      // belasan detik, dan angka yang tidak bergerak di ujung terbaca sebagai macet —
      // persis kesan yang mau dihindari.
      //
      // Yang benar bukan menahan angkanya melainkan mengganti KEADAANNYA. 100 di sini
      // berarti "byte habis terkirim"; pemakai memakainya sebagai isyarat untuk
      // berhenti menampilkan persentase dan mulai menampilkan "menyimpan di server",
      // yang lamanya memang tidak bisa diketahui siapa pun di sisi ini.
      opsi.onProgres?.(Math.floor((e.loaded / e.total) * 100))
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = xhr.response?.data?.[0]
        if (data) { resolve(data as HasilUnggah); return }
        reject(new Error('Balasan unggahan tidak dikenali.'))
        return
      }
      // Pesan dari server dipakai apa adanya kalau ada — ia yang menjelaskan 413
      // (kebesaran) dan 415 (jenis ditolak) dalam bahasa yang sama dengan sisa situs.
      reject(new Error(xhr.response?.statusMessage ?? xhr.response?.message ?? `Gagal mengunggah (${xhr.status}).`))
    }

    xhr.onerror = () => reject(new Error('Koneksi terputus saat mengunggah.'))
    xhr.onabort = () => reject(new Error('Unggahan dibatalkan.'))

    xhr.send(fd)
  })
