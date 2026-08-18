// utils/tiptap-gambar.ts
// Node gambar untuk editor jurnal — <figure> bergambar + keterangan di bawahnya,
// seperti gambar di skripsi.
//
// Kenapa node sendiri, bukan `@tiptap/extension-image` bawaan: yang bawaan hanya
// menyimpan <img> telanjang. Tiga hal yang dibutuhkan tulisan jurnal tidak ada di
// sana — keterangan gambar, perataan, dan lebar — dan ketiganya harus ikut
// tersimpan di HTML supaya halaman publik menggambarnya persis seperti yang
// disusun penulisnya.
//
// Pilihan perataannya sengaja cuma tiga (kiri, tengah, kanan) dan lebarnya sebuah
// persentase: gambar yang bisa ditaruh di mana saja dengan ukuran bebas membuat
// dua tulisan tidak pernah terlihat seperti berasal dari satu situs.

import { Node, mergeAttributes, type NodeViewRenderer } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import JurnalGambarView from '../components/JurnalGambarView.vue'

export type PerataanGambar = 'kiri' | 'tengah' | 'kanan'

export interface OpsiSisipGambar {
  src: string
  alt?: string
  caption?: string
  align?: PerataanGambar
  lebar?: number
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    gambarJurnal: {
      sisipGambarJurnal: (opsi: OpsiSisipGambar) => ReturnType
    }
  }
}

const PERATAAN: PerataanGambar[] = ['kiri', 'tengah', 'kanan']

/**
 * Nama node ditulis sebagai tetapan, lalu dipakai baik di `name` maupun di dalam
 * perintah sisipnya.
 *
 * Bukan `this.name`: memakai `this` di dalam `addCommands` membuat tipe node ini
 * merujuk dirinya sendiri saat sedang disusun, dan TypeScript menyerah dengan
 * "implicitly has type any because it is referenced in its own initializer".
 */
const NAMA = 'gambarJurnal'

/**
 * Tipe hasilnya ditulis eksplisit (`Node`), begitu juga tipe kembalian
 * `addNodeView`. Tanpa keduanya TypeScript menyusun tipe node ini dari isinya,
 * sementara isinya sendiri (NodeView + perintah) merujuk balik ke nodenya —
 * lingkaran yang berakhir dengan "implicitly has type any".
 */
export const GambarJurnal: Node = Node.create({
  name: NAMA,
  group: 'block',
  // `atom`: isinya tidak dikelola ProseMirror. Keterangannya disimpan sebagai
  // atribut dan disunting lewat kotak kecil di NodeView — kalau ia jadi konten
  // sungguhan, kursor bisa "masuk" ke dalam gambar dan Enter di dalam keterangan
  // akan memecah figure-nya jadi dua.
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      caption: { default: '' },
      align: { default: 'tengah' as PerataanGambar },
      /** Persen terhadap lebar tulisan. Dibatasi 25–100 di NodeView. */
      lebar: { default: 100 },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'figure[data-gambar]',
        getAttrs: (el) => {
          const figure = el as HTMLElement
          const img = figure.querySelector('img')
          if (!img) return false

          const align = figure.getAttribute('data-align') as PerataanGambar
          // Lebar dibaca dari style, bukan dari atribut sendiri: itu yang
          // benar-benar menggambar ukurannya di halaman publik, jadi keduanya tidak
          // bisa berbeda.
          const lebar = Number.parseInt(figure.style.width || '100', 10)

          return {
            src: img.getAttribute('src'),
            alt: img.getAttribute('alt'),
            caption: figure.querySelector('figcaption')?.textContent ?? '',
            align: PERATAAN.includes(align) ? align : 'tengah',
            lebar: Number.isFinite(lebar) ? Math.min(100, Math.max(25, lebar)) : 100,
          }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const { src, alt, caption, align, lebar } = HTMLAttributes as Record<string, any>

    const isi: any[] = [['img', { src, alt: alt || caption || '' }]]
    // Keterangan hanya digambar bila ada isinya. <figcaption> kosong tetap memakan
    // satu baris di halaman publik, dan garis bawah gambarnya jadi menggantung.
    if (caption) isi.push(['figcaption', {}, caption])

    return [
      'figure',
      mergeAttributes({
        'data-gambar': '',
        'data-align': PERATAAN.includes(align) ? align : 'tengah',
        'style': `width:${Math.min(100, Math.max(25, Number(lebar) || 100))}%`,
      }),
      ...isi,
    ]
  },

  addNodeView(): NodeViewRenderer {
    return VueNodeViewRenderer(JurnalGambarView)
  },

  addCommands() {
    return {
      sisipGambarJurnal: (opsi: OpsiSisipGambar) => ({ commands }) =>
        commands.insertContent({
          type: NAMA,
          attrs: {
            src: opsi.src,
            alt: opsi.alt ?? '',
            caption: opsi.caption ?? '',
            align: opsi.align ?? 'tengah',
            lebar: opsi.lebar ?? 100,
          },
        }),
    }
  },
})
