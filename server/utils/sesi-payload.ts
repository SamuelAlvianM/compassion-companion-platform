// server/utils/sesi-payload.ts
// Penyusun payload sesi + item, dipakai endpoint publik maupun admin.
//
// Dipisah dari handler karena keduanya membaca bentuk yang sama, hanya berbeda
// dalam hal materi terkunci: yang publik menyamarkan sumbernya, yang admin tidak.

import { asc, eq, inArray } from 'drizzle-orm'
import { db } from '../db'
import { ccMedia, ccSesi, ccSesiItem, type SesiBagian } from '../db/schema'
import { embedYoutube, thumbnailYoutube } from './sesi'

export interface ItemPublik {
  id: string
  bagian: SesiBagian
  jenis: string
  judul: string
  judulEn: string | null
  urutan: number
  terkunci: boolean
  /** true bila terkunci DAN pembaca ini tidak berhak — sumbernya sudah dibuang */
  tergembok: boolean
  url: string | null
  embed: string | null
  thumbnail: string | null
  mediaId: string | null
  ukuran: number | null
  mime: string | null
  namaBerkas: string | null
}

export interface SesiPublik {
  id: string
  judul: string
  judulEn: string | null
  tanggal: Date | null
  urutan: number
  tampil: boolean
  materi: ItemPublik[]
  galeri: ItemPublik[]
  referensi: ItemPublik[]
}

/**
 * @param bolehTerkunci  pembaca berhak membuka materi terkunci
 * @param semuaSesi      sertakan sesi yang `tampil = false` (khusus admin)
 */
export const susunSesi = async (
  kegiatanId: string,
  bolehTerkunci: boolean,
  semuaSesi = false,
): Promise<SesiPublik[]> => {
  const sesiRows = await db
    .select()
    .from(ccSesi)
    .where(eq(ccSesi.kegiatanId, kegiatanId))
    .orderBy(asc(ccSesi.urutan), asc(ccSesi.createdAt))

  const dipakai = semuaSesi ? sesiRows : sesiRows.filter(s => s.tampil)
  if (!dipakai.length) return []

  const itemRows = await db
    .select()
    .from(ccSesiItem)
    .where(inArray(ccSesiItem.sesiId, dipakai.map(s => s.id)))
    .orderBy(asc(ccSesiItem.urutan), asc(ccSesiItem.createdAt))

  // Metadata berkas diambil sekaligus, tanpa `fileData` — blob-nya bisa ratusan MB
  // dan tidak satu pun dipakai di sini.
  const mediaIds = itemRows.map(i => i.mediaId).filter((id): id is string => Boolean(id))
  const mediaPer = new Map<string, { url: string, ukuran: number, mime: string, nama: string }>()
  if (mediaIds.length) {
    const rows = await db
      .select({
        id: ccMedia.id,
        publicUrl: ccMedia.publicUrl,
        fileSize: ccMedia.fileSize,
        mimeType: ccMedia.mimeType,
        originalName: ccMedia.originalName,
      })
      .from(ccMedia)
      .where(inArray(ccMedia.id, mediaIds))
    for (const m of rows) {
      mediaPer.set(m.id, { url: m.publicUrl, ukuran: m.fileSize, mime: m.mimeType, nama: m.originalName })
    }
  }

  const keItem = (row: typeof itemRows[number]): ItemPublik => {
    const media = row.mediaId ? mediaPer.get(row.mediaId) : undefined
    // Materi terkunci tetap ditampilkan judulnya — pembaca perlu tahu materinya ada
    // dan bahwa mendaftar akan membukanya. Yang dibuang cuma jalan ke berkasnya.
    const gembok = row.terkunci && !bolehTerkunci

    return {
      id: row.id,
      bagian: row.bagian,
      jenis: row.jenis,
      judul: row.judul,
      judulEn: row.judulEn,
      urutan: row.urutan,
      terkunci: row.terkunci,
      tergembok: gembok,
      url: gembok ? null : row.url,
      embed: gembok || row.jenis !== 'youtube' || !row.url ? null : embedYoutube(row.url),
      thumbnail: row.jenis === 'youtube' && row.url ? thumbnailYoutube(row.url) : (gembok ? null : media?.url ?? null),
      mediaId: gembok ? null : row.mediaId,
      ukuran: media?.ukuran ?? null,
      mime: gembok ? null : media?.mime ?? null,
      namaBerkas: media?.nama ?? null,
    }
  }

  return dipakai.map(s => {
    const milik = itemRows.filter(i => i.sesiId === s.id).map(keItem)
    return {
      id: s.id,
      judul: s.judul,
      judulEn: s.judulEn,
      tanggal: s.tanggal,
      urutan: s.urutan,
      tampil: s.tampil,
      materi: milik.filter(i => i.bagian === 'materi'),
      galeri: milik.filter(i => i.bagian === 'galeri'),
      referensi: milik.filter(i => i.bagian === 'referensi'),
    }
  })
}
