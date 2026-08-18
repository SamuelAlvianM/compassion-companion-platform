<script setup lang="ts">
// Dua baris jadwal di panel "Informasi acara" halaman detail event: jam acara dan
// batas akhir pendaftaran — sekaligus penyuntingnya saat mode sunting menyala.
//
// Tidak memakai <EditableText> seperti baris lain di panel itu. EditableText
// menyunting satu kolom teks bebas, sementara dua baris ini berisi nilai
// terstruktur: jam `HH:MM` yang menitnya kelipatan lima, dan tanggal+jam yang
// harus jadi satu timestamp. Membiarkannya diketik bebas berarti server menolak
// apa yang tampak sah di layar, dan pengetiknya tidak tahu bentuk mana yang benar.
//
// Keduanya disimpan bersama dalam satu PATCH: keduanya menjawab pertanyaan yang
// sama ("kapan"), dan menyimpannya terpisah membuat setengah jadwal tersimpan
// sementara setengah lagi tidak.

const props = defineProps<{
  event: {
    jamMulai: string | null
    jamSelesai: string | null
    tanggalMulai: string
    tanggalSelesai: string | null
    tutupPendaftaran: string | null
  }
  isEn?: boolean
  /** PATCH sebagian kolom kegiatan; disediakan halaman induk. */
  simpan: (body: Record<string, unknown>) => Promise<void>
}>()

const { aktif } = useEditMode()

const t = computed(() => props.isEn
  ? {
      waktu: 'Time', batas: 'Registration deadline', tanpaBatas: 'Open until the event starts',
      jamMulai: 'Start', jamSelesai: 'End', tanggal: 'Date', jam: 'Time',
      simpan: 'Save schedule', batalkan: 'Cancel', sunting: 'Edit schedule',
      kosongkan: 'Clear deadline', gagal: 'Failed to save the schedule.',
    }
  : {
      waktu: 'Waktu', batas: 'Batas pendaftaran', tanpaBatas: 'Terbuka sampai acara dimulai',
      jamMulai: 'Jam mulai', jamSelesai: 'Jam selesai', tanggal: 'Tanggal', jam: 'Jam',
      simpan: 'Simpan jadwal', batalkan: 'Batal', sunting: 'Ubah jadwal',
      kosongkan: 'Kosongkan batas', gagal: 'Gagal menyimpan jadwal.',
    })

// ── Tampilan baca ────────────────────────────────────────────────────────────
const teksWaktu = computed(() => rentangJam(props.event, props.isEn) || '—')

const teksBatas = computed(() => {
  if (!props.event.tutupPendaftaran) return t.value.tanpaBatas
  return tanggalJamSingkat(props.event.tutupPendaftaran, props.isEn)
})

const sudahLewat = computed(() => batasLewat(props.event.tutupPendaftaran))

// ── Draf ─────────────────────────────────────────────────────────────────────
/** Timestamp → `YYYY-MM-DD` dalam WIB; tanpa ini tanggalnya mundur sehari. */
const keYmd = (nilai: string | null) => nilai
  ? new Intl.DateTimeFormat('en-CA', {
      year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Jakarta',
    }).format(new Date(nilai))
  : ''

/** Timestamp → `HH:MM` dalam WIB, dibulatkan ke bawah ke kelipatan 5 menit
    supaya nilainya bisa diperlihatkan kembali oleh WaktuPicker. */
const keJam = (nilai: string | null) => {
  if (!nilai) return ''
  const jam = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta',
  }).format(new Date(nilai))
  const [h, m] = jam.split('.').length === 2 ? jam.split('.') : jam.split(':')
  return `${h}:${String(Math.floor(Number(m) / 5) * 5).padStart(2, '0')}`
}

const dari = () => ({
  jamMulai: props.event.jamMulai ?? '',
  jamSelesai: props.event.jamSelesai ?? '',
  batasTanggal: keYmd(props.event.tutupPendaftaran),
  batasJam: keJam(props.event.tutupPendaftaran) || '23:55',
})

const menyunting = ref(false)
const draf = ref(dari())
const menyimpan = ref(false)
const galat = ref('')

watch(() => props.event, () => { if (!menyunting.value) draf.value = dari() })

// Mode sunting yang dimatikan di bilah melayang harus ikut menutup panel ini —
// kalau tidak, kotak isian tetap tergambar di halaman yang sudah kembali jadi
// halaman baca.
watch(aktif, (nyala) => { if (!nyala) menyunting.value = false })

const buka = () => {
  draf.value = dari()
  galat.value = ''
  menyunting.value = true
}

/** Jam selesai tidak boleh mendahului jam mulai — tapi hanya untuk event sehari.
    Aturan yang sama ditegakkan ulang di server (validasi-event.ts). */
const sehari = computed(() => {
  if (!props.event.tanggalSelesai) return true
  const ymd = (n: string) => new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Jakarta',
  }).format(new Date(n))
  return ymd(props.event.tanggalSelesai) === ymd(props.event.tanggalMulai)
})

const simpanJadwal = async () => {
  menyimpan.value = true
  galat.value = ''
  try {
    await props.simpan({
      jamMulai: draf.value.jamMulai || null,
      jamSelesai: draf.value.jamSelesai || null,
      // Tanggal kosong berarti tanpa batas. Jamnya sengaja tidak ikut dikirim
      // sendirian: jam tanpa tanggal bukan sebuah batas apa pun.
      tutupPendaftaran: draf.value.batasTanggal
        ? `${draf.value.batasTanggal}T${draf.value.batasJam || '23:55'}`
        : null,
    })
    menyunting.value = false
  }
  catch (e: any) {
    galat.value = e?.data?.statusMessage ?? e?.statusMessage ?? t.value.gagal
  }
  finally { menyimpan.value = false }
}
</script>

<template>
  <!-- Mode baca: dua baris <dl> yang bentuknya persis sama dengan baris lain di
       panel, supaya pengunjung tidak bisa membedakan mana yang bisa disunting. -->
  <template v-if="!menyunting">
    <div>
      <dt>{{ t.waktu }}</dt>
      <dd>
        <span>{{ teksWaktu }}</span>
        <UButton
          v-if="aktif"
          color="neutral"
          variant="ghost"
          size="xs"
          icon="i-lucide-pencil"
          class="ml-1 align-middle"
          :aria-label="t.sunting"
          @click="buka"
        />
      </dd>
    </div>

    <div>
      <dt>{{ t.batas }}</dt>
      <dd>
        <span :class="sudahLewat ? 'text-[#a13a3a]' : ''">{{ teksBatas }}</span>
        <UButton
          v-if="aktif"
          color="neutral"
          variant="ghost"
          size="xs"
          icon="i-lucide-pencil"
          class="ml-1 align-middle"
          :aria-label="t.sunting"
          @click="buka"
        />
      </dd>
    </div>
  </template>

  <!-- Mode sunting: satu blok untuk kedua baris, karena disimpan bersama. -->
  <div v-else class="col-span-full">
    <div class="rounded-lg border border-cc-stone-200 bg-cc-stone-50 p-3">
      <div class="grid gap-3 sm:grid-cols-2">
        <UFormField :label="t.jamMulai" size="sm">
          <WaktuPicker v-model="draf.jamMulai" size="sm" />
        </UFormField>
        <UFormField :label="t.jamSelesai" size="sm">
          <WaktuPicker
            v-model="draf.jamSelesai"
            size="sm"
            :minimal="sehari ? draf.jamMulai : null"
          />
        </UFormField>
      </div>

      <p class="mt-3 text-xs font-semibold uppercase tracking-wider text-cc-stone-500">
        {{ t.batas }}
      </p>
      <div class="mt-1.5 grid gap-3 sm:grid-cols-2">
        <UFormField :label="t.tanggal" size="sm">
          <TanggalPicker
            v-model="draf.batasTanggal"
            size="sm"
            :maksimal="keYmd(props.event.tanggalMulai)"
            :is-en="isEn"
          />
        </UFormField>
        <UFormField :label="t.jam" size="sm">
          <WaktuPicker v-model="draf.batasJam" size="sm" :disabled="!draf.batasTanggal" />
        </UFormField>
      </div>

      <p v-if="galat" class="editable-error">{{ galat }}</p>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <UButton color="secondary" size="xs" icon="i-lucide-save" :loading="menyimpan" @click="simpanJadwal">
          {{ t.simpan }}
        </UButton>
        <UButton color="neutral" variant="ghost" size="xs" @click="menyunting = false">
          {{ t.batalkan }}
        </UButton>
        <UButton
          v-if="draf.batasTanggal"
          color="neutral"
          variant="link"
          size="xs"
          icon="i-lucide-x"
          @click="draf.batasTanggal = ''"
        >
          {{ t.kosongkan }}
        </UButton>
      </div>
    </div>
  </div>
</template>
