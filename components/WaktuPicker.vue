<script setup lang="ts">
// Pemilih jam `HH:MM` dengan menit kelipatan 5.
//
// Bukan `<input type="time">`: tampilannya ditentukan browser sehingga tidak bisa
// diselaraskan dengan palet situs — alasan yang sama yang dulu memindahkan filter
// tanggal ke `UCalendar` (lihat journal Sesi 4). Ia juga tidak bisa dibatasi ke
// kelipatan lima menit dengan cara yang benar-benar terlihat: atribut `step` hanya
// memvalidasi, dan pengguna tetap bisa mengetik 09:03 lalu menerima galat.
//
// Dua kolom yang bisa digulir, bukan satu daftar berisi 288 pilihan: mencari 16.45
// di dalam daftar sepanjang itu berarti menggulir jauh, sementara memilih jam lalu
// menit hanya dua ketukan.

const props = withDefaults(defineProps<{
  /** `HH:MM`, atau string kosong bila belum dipilih. */
  modelValue?: string | null
  placeholder?: string
  disabled?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg'
  /** Jam sebelum nilai ini tidak bisa dipilih — dipakai "jam selesai" agar tidak
      bisa mendahului "jam mulai" pada event sehari. */
  minimal?: string | null
}>(), {
  modelValue: '',
  placeholder: 'Pilih jam',
  size: 'md',
})

const emit = defineEmits<{ 'update:modelValue': [string] }>()

const terbuka = ref(false)

const nilai = computed(() => props.modelValue ?? '')
const jamTerpilih = computed(() => nilai.value.split(':')[0] ?? '')
const menitTerpilih = computed(() => nilai.value.split(':')[1] ?? '')

const JAM = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MENIT = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

/** Tampilan memakai titik ("16.45"), gaya penulisan jam Indonesia. */
const label = computed(() => nilai.value ? nilai.value.replace(':', '.') : '')

/** Sebuah kombinasi jam+menit tidak boleh mendahului `minimal`. */
const terlarang = (jam: string, menit: string) =>
  Boolean(props.minimal) && `${jam}:${menit}` <= props.minimal!

/** Satu kolom mati seluruhnya kalau tidak ada satu pun menit yang sah di jam itu. */
const jamMati = (jam: string) => MENIT.every(m => terlarang(jam, m))

const pilihJam = (jam: string) => {
  // Menit dipertahankan bila sudah ada. Kalau kombinasinya jadi terlarang, ambil
  // menit sah pertama di jam itu — memaksa orang membetulkan menitnya sendiri
  // setelah mengganti jam hanya menambah satu langkah tanpa menambah pilihan.
  const menit = menitTerpilih.value || '00'
  const dipakai = terlarang(jam, menit) ? MENIT.find(m => !terlarang(jam, m)) ?? '00' : menit
  emit('update:modelValue', `${jam}:${dipakai}`)
}

const pilihMenit = (menit: string) => {
  const jam = jamTerpilih.value || JAM.find(j => !jamMati(j)) || '00'
  emit('update:modelValue', `${jam}:${menit}`)
  terbuka.value = false
}

const bersihkan = () => {
  emit('update:modelValue', '')
  terbuka.value = false
}

/** Gulirkan pilihan yang sedang aktif ke tengah saat popover dibuka. */
const kolomJam = useTemplateRef<HTMLElement>('kolomJam')
const kolomMenit = useTemplateRef<HTMLElement>('kolomMenit')

watch(terbuka, async (buka) => {
  if (!buka) return
  await nextTick()
  for (const kolom of [kolomJam.value, kolomMenit.value]) {
    const aktif = kolom?.querySelector('[data-aktif="true"]') as HTMLElement | null
    if (aktif) kolom!.scrollTop = aktif.offsetTop - kolom!.clientHeight / 2 + aktif.clientHeight / 2
  }
})
</script>

<template>
  <UPopover v-model:open="terbuka" :ui="{ content: 'p-0' }">
    <UButton
      color="neutral"
      variant="outline"
      icon="i-lucide-clock"
      :size="size"
      :disabled="disabled"
      class="w-full justify-start"
      :ui="{ leadingIcon: 'text-dimmed' }"
    >
      <span :class="label ? '' : 'text-dimmed'">{{ label || placeholder }}</span>
    </UButton>

    <template #content>
      <div class="w-56">
        <div class="flex divide-x divide-cc-stone-200">
          <div class="flex-1">
            <p class="px-3 pt-2 text-[11px] font-semibold uppercase tracking-wider text-cc-stone-500">
              Jam
            </p>
            <div ref="kolomJam" class="max-h-52 overflow-y-auto p-1.5">
              <button
                v-for="j in JAM"
                :key="j"
                type="button"
                :data-aktif="j === jamTerpilih"
                :disabled="jamMati(j)"
                class="block w-full rounded px-2 py-1 text-left text-sm tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-35"
                :class="j === jamTerpilih
                  ? 'bg-cc-green-800 font-semibold text-white'
                  : 'text-cc-stone-700 hover:bg-cc-stone-100'"
                @click="pilihJam(j)"
              >
                {{ j }}
              </button>
            </div>
          </div>

          <div class="flex-1">
            <p class="px-3 pt-2 text-[11px] font-semibold uppercase tracking-wider text-cc-stone-500">
              Menit
            </p>
            <div ref="kolomMenit" class="max-h-52 overflow-y-auto p-1.5">
              <button
                v-for="m in MENIT"
                :key="m"
                type="button"
                :data-aktif="m === menitTerpilih"
                :disabled="Boolean(jamTerpilih) && terlarang(jamTerpilih, m)"
                class="block w-full rounded px-2 py-1 text-left text-sm tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-35"
                :class="m === menitTerpilih
                  ? 'bg-cc-green-800 font-semibold text-white'
                  : 'text-cc-stone-700 hover:bg-cc-stone-100'"
                @click="pilihMenit(m)"
              >
                {{ m }}
              </button>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between border-t border-cc-stone-200 px-2 py-1.5">
          <UButton color="neutral" variant="ghost" size="xs" @click="bersihkan">
            Kosongkan
          </UButton>
          <span class="pr-1 text-xs tabular-nums text-cc-stone-500">{{ label || '—' }}</span>
        </div>
      </div>
    </template>
  </UPopover>
</template>
