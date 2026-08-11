// server/utils/randomId.ts
// Generator ID pendek, mengikuti pola website-cosmos (generateSmeId) tapi dengan prefix `cc-`.

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

export const generateCcId = (prefix = 'cc') => {
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += CHARS.charAt(Math.floor(Math.random() * CHARS.length))
  }
  return `${prefix}-${result}`
}

export const slugify = (text: string) =>
  text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')

/** Nomor transaksi berformat CC/2026/08/A1B2C3D4 */
export const generateNomorTransaksi = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  let tail = ''
  for (let i = 0; i < 8; i++) tail += CHARS.charAt(Math.floor(Math.random() * CHARS.length))
  return `CC/${year}/${month}/${tail.toUpperCase()}`
}
