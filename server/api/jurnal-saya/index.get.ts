// server/api/jurnal-saya/index.get.ts
// Daftar tulisan MILIK orang yang sedang login — layar member, bukan dashboard.
//
// Terpisah dari /api/admin/jurnal karena penontonnya berbeda, dan yang berbeda
// bukan cuma hak aksesnya melainkan ISINYA: member tidak pernah melihat siapa
// editor yang mengurus tulisannya, dan tidak melihat jurnal orang lain sama sekali.

import { desc, eq } from 'drizzle-orm'
import { db } from '../../db'
import { ccJurnal } from '../../db/schema'
import { wajibLogin } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const user = await wajibLogin(event)

  const rows = await db
    .select({
      id: ccJurnal.id,
      slug: ccJurnal.slug,
      judul: ccJurnal.judul,
      status: ccJurnal.status,
      catatanRevisi: ccJurnal.catatanRevisi,
      diterbitkanPada: ccJurnal.diterbitkanPada,
      updatedAt: ccJurnal.updatedAt,
    })
    .from(ccJurnal)
    .where(eq(ccJurnal.dibuatOleh, user.id))
    .orderBy(desc(ccJurnal.updatedAt))

  return { data: rows }
})
