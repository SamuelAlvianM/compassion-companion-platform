// server/utils/media-services.ts
// Logika bersama untuk unggah/ambil/hapus media.
// Blob disimpan di kolom cc_media.file_data (bukan di filesystem), lalu dilayani
// lewat /api/storage/[...path] — sama seperti website-cosmos, hanya bytea -> blob.

import { eq } from 'drizzle-orm'
import { db } from '../db'
import {
  ccMedia,
  ccMediaGambar,
  ccMediaVideo,
  ccMediaEtc,
  type MediaKind,
  type DocType,
} from '../db/schema'
import { generateCcId } from './randomId'

/** Batas ukuran per jenis (byte). Disesuaikan supaya blob di SQLite tetap wajar. */
export const MEDIA_LIMITS: Record<MediaKind, number> = {
  gambar: 10 * 1024 * 1024, // 10 MB
  video: 100 * 1024 * 1024, // 100 MB
  etc: 25 * 1024 * 1024, // 25 MB
}

const DOC_MIME_MAP: Record<string, DocType> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'doc',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xls',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'ppt',
  'text/csv': 'csv',
}

/** Tentukan tabel subtype mana yang dipakai berdasarkan mime type. */
export const classifyMime = (mimeType: string): MediaKind => {
  if (mimeType.startsWith('image/')) return 'gambar'
  if (mimeType.startsWith('video/')) return 'video'
  return 'etc'
}

export const docTypeOf = (mimeType: string): DocType => DOC_MIME_MAP[mimeType] ?? 'lainnya'

/** Ambil dimensi gambar langsung dari header file — tanpa dependensi tambahan. */
export const readImageSize = (buf: Buffer): { width: number; height: number } | null => {
  try {
    // PNG: signature 8 byte, lalu IHDR width/height sebagai uint32 BE
    if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
    }
    // GIF: little-endian uint16 di offset 6 dan 8
    if (buf.length > 10 && buf.toString('ascii', 0, 3) === 'GIF') {
      return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) }
    }
    // WebP: RIFF....WEBP lalu satu chunk yang bentuknya berbeda per varian.
    // Perlu ditangani sejak seluruh unggahan gambar dikodekan ulang jadi WebP di
    // sisi peramban — tanpa cabang ini, width/height setiap gambar baru null.
    if (buf.length > 30 && buf.toString('ascii', 0, 4) === 'RIFF'
      && buf.toString('ascii', 8, 12) === 'WEBP') {
      const chunk = buf.toString('ascii', 12, 16)
      // Lossy: dua uint16 LE di offset 26, 14 bit terpakai.
      if (chunk === 'VP8 ') {
        return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff }
      }
      // Lossless: 14 bit lebar lalu 14 bit tinggi, dikemas mulai offset 21.
      if (chunk === 'VP8L') {
        const bits = buf.readUInt32LE(21)
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
      }
      // Diperluas (dipakai saat ada alpha): dua uint24 LE, nilainya kurang satu.
      if (chunk === 'VP8X') {
        const uint24 = (o: number) => buf[o]! | (buf[o + 1]! << 8) | (buf[o + 2]! << 16)
        return { width: uint24(24) + 1, height: uint24(27) + 1 }
      }
    }
    // JPEG: telusuri marker sampai ketemu SOFn
    if (buf.length > 4 && buf.readUInt16BE(0) === 0xffd8) {
      let off = 2
      while (off < buf.length - 9) {
        if (buf[off] !== 0xff) { off++; continue }
        const marker = buf[off + 1]!
        // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7) }
        }
        off += 2 + buf.readUInt16BE(off + 2)
      }
    }
  } catch {
    // Format tak dikenal / header rusak — bukan alasan menggagalkan unggahan.
  }
  return null
}

export interface SimpanMediaInput {
  originalName: string
  mimeType: string
  data: Buffer
  uploadedBy?: string | null
  /** Batasi ke satu jenis saja, mis. 'gambar' untuk field foto profil. */
  hanyaKind?: MediaKind
  altText?: string
  caption?: string
}

/**
 * Simpan satu file: baris di cc_media (berisi blob) + baris metadata di tabel subtype.
 * Mengembalikan record tanpa fileData supaya aman dikirim sebagai JSON.
 */
export const simpanMedia = async (input: SimpanMediaInput) => {
  const { originalName, mimeType, data, uploadedBy = null, hanyaKind } = input

  const kind = classifyMime(mimeType)
  if (hanyaKind && kind !== hanyaKind) {
    throw createError({
      statusCode: 415,
      statusMessage: `Jenis file tidak sesuai. Dibutuhkan ${hanyaKind}, diterima ${mimeType}.`,
    })
  }

  const limit = MEDIA_LIMITS[kind]
  if (data.length > limit) {
    throw createError({
      statusCode: 413,
      statusMessage: `Ukuran file melebihi batas ${Math.round(limit / 1024 / 1024)} MB.`,
    })
  }
  if (data.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'File kosong.' })
  }

  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const ext = originalName.includes('.') ? originalName.split('.').pop()!.toLowerCase() : 'bin'
  const id = generateCcId('ccm')
  const fileName = `${id}.${ext}`
  const storageKey = `/storage/uploads/${year}/${month}/${fileName}`
  const publicUrl = `/api/storage/uploads/${year}/${month}/${fileName}`

  // Master + subtype ditulis dalam satu transaksi supaya tidak ada media yatim.
  return db.transaction((tx) => {
    const [media] = tx
      .insert(ccMedia)
      .values({
        id,
        originalName,
        fileName,
        mimeType,
        fileSize: data.length,
        storageKey,
        publicUrl,
        fileData: data,
        kind,
        uploadedBy,
        uploadedAt: now,
      })
      .returning()
      .all()

    if (kind === 'gambar') {
      const size = readImageSize(data)
      tx.insert(ccMediaGambar)
        .values({
          mediaId: id,
          mimeType,
          width: size?.width ?? null,
          height: size?.height ?? null,
          altText: input.altText ?? null,
          caption: input.caption ?? null,
        })
        .run()
    } else if (kind === 'video') {
      tx.insert(ccMediaVideo).values({ mediaId: id, mimeType }).run()
    } else {
      tx.insert(ccMediaEtc)
        .values({
          mediaId: id,
          mimeType,
          docType: docTypeOf(mimeType),
          displayTitle: originalName.replace(/\.[^.]+$/, ''),
        })
        .run()
    }

    const { fileData: _blob, ...safe } = media!
    return safe
  })
}

export const mediaService = {
  /** Cari berdasarkan storageKey — dipakai oleh /api/storage/[...path]. */
  async getByStorageKey(storageKey: string) {
    return db.query.ccMedia.findFirst({ where: eq(ccMedia.storageKey, storageKey) })
  },

  async getByUrl(url: string) {
    return db.query.ccMedia.findFirst({ where: eq(ccMedia.publicUrl, url) })
  },

  /** Hapus media; baris subtype ikut terhapus lewat ON DELETE CASCADE. */
  async deleteMedia(id: string) {
    return db.delete(ccMedia).where(eq(ccMedia.id, id)).returning({ id: ccMedia.id }).all()
  },
}
