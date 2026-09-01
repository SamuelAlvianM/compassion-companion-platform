<script setup lang="ts">
// Pemilih tanggal `YYYY-MM-DD`, pasangan WaktuPicker.
//
// Bukan `<input type="date">`: tampilannya ditentukan browser, jadi ia tidak bisa
// diselaraskan dengan palet situs dan berdiri sebagai satu-satunya kotak berbeda
// wajah di tengah formulir yang seluruh isiannya sudah seragam. Alasan yang sama
// pernah memindahkan filter tanggal halaman event ke `UCalendar` (Sesi 4); filter
// itu dicabut di Sesi 10 dan polanya ikut hilang — di sini ia kembali sebagai
// komponen, bukan sebagai salinan di tiap formulir.
//
// `UCalendar` bekerja dengan `DateValue` dari `@internationalized/date`, yang
// **bebas zona waktu**. Itu yang membuatnya aman di sini: `YYYY-MM-DD` disusun
// dari `year/month/day` langsung, tanpa pernah melewati `Date` atau
// `toISOString()` — jalur yang dulu memundurkan tanggal sehari bagi pembaca di
// Indonesia (Sesi 3).

import { CalendarDate, type DateValue } from "@internationalized/date";

const props = withDefaults(
  defineProps<{
    /** `YYYY-MM-DD`, atau string kosong bila belum dipilih. */
    modelValue?: string | null;
    placeholder?: string;
    disabled?: boolean;
    size?: "xs" | "sm" | "md" | "lg";
    /** Tanggal sebelum ini tidak bisa dipilih (`YYYY-MM-DD`). */
    minimal?: string | null;
    /** Tanggal sesudah ini tidak bisa dipilih (`YYYY-MM-DD`). */
    maksimal?: string | null;
    isEn?: boolean;
  }>(),
  {
    modelValue: "",
    size: "md",
  },
);

const emit = defineEmits<{ "update:modelValue": [string] }>();

const terbuka = ref(false);

/** `YYYY-MM-DD` → `CalendarDate`. Kosong jadi `undefined`, bukan `null`: Reka UI
    membaca `null` sebagai nilai, bukan sebagai "belum dipilih". */
const keCalendarDate = (
  nilai: string | null | undefined,
): CalendarDate | undefined => {
  if (!nilai) return undefined;
  const [y, b, h] = nilai.split("-").map(Number);
  if (!y || !b || !h) return undefined;
  return new CalendarDate(y, b, h);
};

const keYmd = (d: DateValue) =>
  `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;

const nilai = computed({
  get: () => keCalendarDate(props.modelValue),
  set: (d) => {
    if (!d) return;
    emit("update:modelValue", keYmd(d));
    terbuka.value = false;
  },
});

const t = computed(() =>
  props.isEn
    ? { pilih: "Choose a date", kosongkan: "Clear" }
    : { pilih: "Pilih tanggal", kosongkan: "Kosongkan" },
);

/** "12 Agu 2026" — sama gayanya dengan tanggal di tabel admin. */
const label = computed(() =>
  props.modelValue
    ? new Intl.DateTimeFormat(props.isEn ? "en-GB" : "id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Jakarta",
      }).format(new Date(`${props.modelValue}T12:00:00`))
    : "",
);

const batasBawah = computed(() => keCalendarDate(props.minimal));
const batasAtas = computed(() => keCalendarDate(props.maksimal));

const bersihkan = () => {
  emit("update:modelValue", "");
  terbuka.value = false;
};
</script>

<template>
  <UPopover v-model:open="terbuka" :ui="{ content: 'p-0' }">
    <UButton
      color="neutral"
      variant="outline"
      icon="i-lucide-calendar"
      :size="size"
      :disabled="disabled"
      class="w-full justify-start"
      :ui="{ leadingIcon: 'text-dimmed' }"
    >
      <span :class="label ? '' : 'text-dimmed'">{{
        label || placeholder || t.pilih
      }}</span>
    </UButton>

    <template #content>
      <div>
        <UCalendar
          v-model="nilai"
          :min-value="batasBawah"
          :max-value="batasAtas"
          color="secondary"
          class="p-2"
          :ui="{
            cellTrigger: [
              'cursor-pointer',
              'data-[disabled]:pointer-events-auto data-[disabled]:cursor-not-allowed',
              'data-[unavailable]:pointer-events-auto data-[unavailable]:cursor-not-allowed',
            ],
          }"
        />
        <div
          class="flex items-center justify-between border-t border-cc-stone-200 px-2 py-1.5"
        >
          <UButton color="neutral" variant="ghost" size="xs" @click="bersihkan">
            {{ t.kosongkan }}
          </UButton>
          <span class="pr-1 text-xs text-cc-stone-500">{{ label || "—" }}</span>
        </div>
      </div>
    </template>
  </UPopover>
</template>
