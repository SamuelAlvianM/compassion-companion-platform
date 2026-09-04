<script setup lang="ts">
// Daftar event admin — kini dari database, bukan array literal.
// Draft ikut tampil di sini (berbeda dari /api/events publik yang menyaringnya).
definePageMeta({ layout: "admin" });

const cari = ref("");
// 'semua' sebagai sentinel: Reka UI memesan string kosong untuk keadaan "belum
// dipilih" dan melempar error kalau ada item bernilai ''.
//
// Yang disaring FASE, bukan kolom `status`. Status redaksional
// (draft/terbit/selesai/batal) sudah tidak dipasang formulir mana pun sejak fase
// dijadikan murni turunan tanggal, jadi menyaringnya hanya akan menawarkan
// pembedaan yang tidak bisa lagi dibuat siapa pun.
const fase = ref("semua");

// Pencarian di-debounce supaya tiap ketikan tidak jadi satu permintaan.
// Ditulis manual, mengikuti pola yang sama di pages/admin/members.vue — VueUse
// tidak terpasang sebagai modul Nuxt di project ini, jadi refDebounced tidak
// tersedia lewat auto-import.
const cariDebounce = ref("");
let timer: ReturnType<typeof setTimeout> | undefined;
watch(cari, (nilai) => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    cariDebounce.value = nilai;
  }, 300);
});

const {
  data,
  status: muat,
  refresh,
} = useFetch("/api/admin/events", {
  query: computed(() => ({
    cari: cariDebounce.value || undefined,
    fase: fase.value === "semua" ? undefined : fase.value,
  })),
});

const perFase = computed(
  () => data.value?.meta?.perFase ?? ({} as Record<string, number>),
);

const faseOptions = computed(() => [
  { value: "semua", label: "Semua fase" },
  { value: "mendatang", label: "Mendatang" },
  { value: "berlangsung", label: "Berlangsung" },
  { value: "selesai", label: "Selesai" },
  { value: "batal", label: "Dibatalkan" },
]);

/**
 * Ikon tombol dropdown. Tetap, bukan mengikuti pilihan: `icon` per fase tidak
 * ada lagi di `faseOptions`, jadi pencariannya selalu jatuh ke nilai cadangan
 * ini — sebuah computed yang hasilnya tidak pernah berubah.
 */
const ikonFase = "i-lucide-layers";

const tanggal = (nilai: string | null) =>
  nilai
    ? new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Jakarta",
      }).format(new Date(nilai))
    : "—";

const warnaFase = (f: string) =>
  (({
    mendatang: "accent",
    berlangsung: "secondary",
    selesai: "neutral",
    batal: "error",
  })[f] ?? "neutral") as "neutral" | "accent" | "secondary" | "error";

// ── Hapus ────────────────────────────────────────────────────────────────────
const hapusTarget = ref<{ id: string; judul: string } | null>(null);
const galat = ref("");
const sibuk = ref(false);

const hapus = async () => {
  if (!hapusTarget.value) return;
  sibuk.value = true;
  galat.value = "";
  try {
    await $fetch(`/api/admin/events/${hapusTarget.value.id}`, {
      method: "DELETE",
    });
    hapusTarget.value = null;
    await refresh();
  } catch (e: any) {
    // Server menolak menghapus event yang sudah punya peserta; pesannya
    // ditampilkan apa adanya karena ia sudah menjelaskan jalan keluarnya.
    galat.value =
      e?.data?.statusMessage ?? e?.statusMessage ?? "Gagal menghapus event.";
  } finally {
    sibuk.value = false;
  }
};
const urutan = ref("terbaru");

const urutanOptions = computed(() => [
  {
    value: "terbaru",
    label: "Terbaru",
    icon: "i-lucide-arrow-down-wide-narrow",
  },
  {
    value: "terlama",
    label: "Terlama",
    icon: "i-lucide-arrow-up-narrow-wide",
  },
  {
    value: "az",
    label: "Judul A–Z",
    icon: "i-lucide-arrow-down-a-z",
  },
  {
    value: "za",
    label: "Judul Z–A",
    icon: "i-lucide-arrow-up-a-z",
  },
]);

const ikonUrutan = computed(
  () =>
    urutanOptions.value.find((o) => o.value === urutan.value)?.icon ??
    "i-lucide-arrow-down-wide-narrow",
);

// Diurutkan di klien, bukan lewat query ke server: daftar ini tidak berpaginasi —
// seluruh barisnya memang sudah ada di tangan — dan A–Z tidak bisa diminta ke
// SQLite dengan hasil yang sama. `localeCompare('id')` menyamakan huruf besar dan
// kecil; `<` biasa mengurutkan menurut kode karakter, sehingga "wawancara" mendarat
// sebelum "Zoom" tapi sesudah "Bengkel".
//
// Sebelumnya kotak urutannya tergambar tapi nilainya tidak pernah dibaca siapa pun:
// tiap pilihan mengubah tulisan di kotaknya sendiri dan tidak lebih.
const waktuMulai = (nilai: string | null) =>
  nilai ? new Date(nilai).getTime() : 0;

const events = computed(() => {
  const baris = [...(data.value?.data ?? [])];
  switch (urutan.value) {
    case "terlama":
      return baris.sort(
        (a, b) => waktuMulai(a.tanggalMulai) - waktuMulai(b.tanggalMulai),
      );
    case "az":
      return baris.sort((a, b) => a.judul.localeCompare(b.judul, "id"));
    case "za":
      return baris.sort((a, b) => b.judul.localeCompare(a.judul, "id"));
    default:
      return baris.sort(
        (a, b) => waktuMulai(b.tanggalMulai) - waktuMulai(a.tanggalMulai),
      );
  }
});

// Delapan kolom → lima (Sesi 10) → empat.
//
// Penyusutan sebelumnya menggabungkan kolom, bukan membuang isinya: lima kolom itu
// masih memuat tujuh angka per baris — lokasi, jam, batas pendaftaran, jumlah sesi,
// jumlah materi, terdaftar, kuota — dan barisnya jadi tiga tingkat tinggi.
//
// Yang benar-benar ditanyakan orang pada daftar ini cuma dua: event yang mana, dan
// mana yang menuntut dikerjakan sekarang. Sisanya ada di halaman eventnya, satu
// klik dari sini, dalam bentuk yang bisa langsung disunting. Yang tinggal: nama,
// tanggal, fase, dan penanda pendaftar yang belum selesai diurus.
const columns = [
  { accessorKey: "judul", header: "Event" },
  { accessorKey: "tanggalMulai", header: "Tanggal" },
  { accessorKey: "fase", header: "Fase" },
  { accessorKey: "aksi", header: "" },
];
</script>

<template>
  <div class="mx-auto max-w-8xl">
    <div class="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="font-serif text-5xl text-cc-green-800">Event</h1>
        <p class="mt-2 text-sm text-cc-stone-600">
          Kelola program, peserta, materi, dan dokumentasi.
        </p>
      </div>
      <UButton
        to="/admin/event/new"
        color="secondary"
        size="lg"
        icon="i-lucide-plus"
        class="shrink-0"
      >
        Tambah Event
      </UButton>
    </div>

    <div class="mb-4 flex flex-wrap items-center gap-3">
      <UInput
        v-model="cari"
        icon="i-lucide-search"
        placeholder="Cari judul atau slug…"
        class="w-72"
      />
      <!-- :icon="ikonFase" dihilangkan boss gamau ada ikon fasenya  -->
      <USelect
        v-model="fase"
        :items="faseOptions"
        value-key="value"
        class="w-48"
      />

      <USelect
        v-model="urutan"
        :items="urutanOptions"
        value-key="value"
        :icon="ikonUrutan"
        :aria-label="'Urutkan Data'"
        class="w-48"
      />

      <!-- Hitungan per fase dipasang sebagai chip: ia menjawab "berapa yang sedang
           berjalan" tanpa perlu mengganti filter satu per satu untuk membacanya. -->
      <!-- <div class="flex flex-wrap items-center gap-1.5">
        <UBadge
          v-for="o in faseOptions.slice(1)"
          :key="o.value"
          :color="fase === o.value ? warnaFase(o.value) : 'neutral'"
          :variant="fase === o.value ? 'solid' : 'subtle'"
          size="sm"
          class="cursor-pointer rounded-full"
          @click="fase = fase === o.value ? 'semua' : o.value"
        >
          {{ o.label }} · {{ perFase[o.value] ?? 0 }}
        </UBadge>
      </div>

      <span class="ml-auto text-sm text-cc-stone-600"
        >{{ events.length }} event</span
      > -->
    </div>

    <!-- Tabel dari `md` ke atas; kartu per baris di bawahnya. -->
    <UCard :ui="{ body: 'p-0' }" class="hidden md:block">
      <UTable
        :data="events"
        :columns="columns"
        :loading="muat === 'pending'"
        empty="Belum ada event. Klik “Event baru” untuk membuat yang pertama."
      >
        <!-- Nama event, dan di sebelahnya satu-satunya hal di daftar ini yang
             menuntut tindakan: pendaftar yang belum selesai diurus.

             Yang terlihat cuma IKONNYA; angkanya pindah ke tooltip. Daftar ini
             dibaca dengan menyapu ke bawah untuk menemukan baris yang menuntut
             dikerjakan — untuk itu cukup "ada" atau "tidak ada", dan lencana
             berangka di samping tiap judul menambah satu benda yang harus dibaca
             pada baris yang justru sedang tidak dicari. Seberapa banyaknya baru
             berarti sesudah barisnya ketemu, dan di situ tangannya sudah di atas
             barisnya. -->
        <template #judul-cell="{ row }">
          <div class="flex items-center gap-2">
            <NuxtLink
              :to="`/admin/event/${row.original.id}`"
              class="font-semibold text-cc-green-800 hover:text-cc-brown-500 hover:underline"
            >
              {{ row.original.judul }}
            </NuxtLink>
            <UTooltip
              v-if="row.original.belumKonfirmasi"
              :delay-duration="0"
              :text="`Masih ada ${row.original.belumKonfirmasi} peserta yang perlu diproses`"
            >
              <!-- Angkanya ikut muncul saat disentuh, bukan hanya di dalam tooltip:
                   yang sudah mengarahkan tetikus ke sini sedang menimbang apakah
                   baris ini perlu dibuka sekarang, dan "satu" berbeda jauh dari
                   "dua belas". Ia melebar dari nol, jadi baris di sebelahnya tidak
                   ikut bergeser saat diam.

                   `tabindex` supaya tooltipnya juga terbuka lewat papan ketik, dan
                   `aria-label` supaya yang memakai pembaca layar tidak cuma mendengar
                   sebuah ikon tanpa nama. -->
              <span
                class="group inline-flex items-center rounded-full bg-red-50 p-1 text-red-700"
                tabindex="0"
                role="img"
                :aria-label="`Masih ada ${row.original.belumKonfirmasi} peserta yang perlu diproses`"
              >
                <UIcon name="i-lucide-user-round-x" class="size-3.5 shrink-0" />
                <span
                  class="max-w-0 overflow-hidden text-xs font-semibold tabular-nums transition-[max-width,padding] duration-150 group-hover:max-w-8 group-hover:ps-1 group-focus:max-w-8 group-focus:ps-1"
                >
                  {{ row.original.belumKonfirmasi }}
                </span>
              </span>
            </UTooltip>
          </div>
        </template>

        <template #tanggalMulai-cell="{ row }">
          <div class="text-sm whitespace-nowrap">
            {{ tanggal(row.original.tanggalMulai) }}
            <template
              v-if="
                row.original.tanggalSelesai &&
                row.original.tanggalSelesai !== row.original.tanggalMulai
              "
            >
              – {{ tanggal(row.original.tanggalSelesai) }}
            </template>
          </div>
        </template>

        <!-- Fase, bukan status: dihitung dari tanggal setiap kali dibaca, jadi tidak
             ada yang perlu diperbarui manual saat tanggalnya terlewat. -->
        <template #fase-cell="{ row }">
          <UBadge
            :color="warnaFase(row.original.fase)"
            size="md"
            class="event-badge rounded-full capitalize"
          >
            {{ row.original.fase }}
          </UBadge>
        </template>

        <template #aksi-cell="{ row }">
          <div class="flex justify-end gap-1">
            <UTooltip text="Ubah event & materi">
              <UButton
                :to="`/admin/event/${row.original.id}`"
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-lucide-pencil"
                aria-label="Ubah"
              />
            </UTooltip>
            <UTooltip text="Hapus event">
              <UButton
                color="error"
                variant="ghost"
                size="sm"
                icon="i-lucide-trash-2"
                aria-label="Hapus"
                @click="
                  hapusTarget = {
                    id: row.original.id,
                    judul: row.original.judul,
                  };
                  galat = '';
                "
              />
            </UTooltip>
          </div>
        </template>
      </UTable>
    </UCard>

    <!-- Layar sempit: satu kartu per event.
         Penanda "masih ada peserta yang perlu diproses" di sini ditulis sebagai
         teks berangka, bukan ikon yang melebar saat disentuh — di ponsel tidak ada
         tetikus yang bisa mengarah, dan tooltip yang hanya terbuka lewat hover
         berarti angkanya tidak pernah terbaca sama sekali. -->
    <div class="space-y-3 md:hidden">
      <p v-if="muat === 'pending'" class="text-sm text-cc-stone-500">Memuat…</p>

      <p
        v-else-if="!events.length"
        class="rounded-lg border border-cc-stone-200 bg-white p-4 text-sm text-cc-stone-500"
      >
        Belum ada event.
      </p>

      <div
        v-for="e in events"
        :key="e.id"
        class="rounded-lg border border-cc-stone-200 bg-white p-4"
      >
        <div class="flex items-start justify-between gap-3">
          <NuxtLink
            :to="`/admin/event/${e.id}`"
            class="min-w-0 font-semibold break-words text-cc-green-800"
          >
            {{ e.judul }}
          </NuxtLink>

          <div class="flex shrink-0 gap-1">
            <UButton
              :to="`/admin/event/${e.id}`"
              color="neutral"
              variant="ghost"
              size="sm"
              icon="i-lucide-pencil"
              :aria-label="`Ubah ${e.judul}`"
            />
            <UButton
              color="error"
              variant="ghost"
              size="sm"
              icon="i-lucide-trash-2"
              :aria-label="`Hapus ${e.judul}`"
              @click="
                hapusTarget = { id: e.id, judul: e.judul };
                galat = '';
              "
            />
          </div>
        </div>

        <div
          class="mt-3 flex flex-wrap items-center gap-2 border-t border-cc-stone-100 pt-3"
        >
          <UBadge
            :color="warnaFase(e.fase)"
            size="md"
            class="event-badge rounded-full capitalize"
          >
            {{ e.fase }}
          </UBadge>
          <span class="text-sm text-cc-stone-600">{{
            tanggal(e.tanggalMulai)
          }}</span>
          <span
            v-if="e.belumKonfirmasi"
            class="ml-auto inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700"
          >
            <UIcon name="i-lucide-user-round-x" class="size-3.5 shrink-0" />
            {{ e.belumKonfirmasi }} perlu diproses
          </span>
        </div>
      </div>
    </div>

    <UModal
      :open="Boolean(hapusTarget)"
      title="Hapus event"
      @update:open="hapusTarget = null"
    >
      <template #body>
        <p class="text-sm text-cc-stone-700">
          Hapus <strong>{{ hapusTarget?.judul }}</strong
          >? Seluruh sesi dan materinya ikut terhapus. Berkas di pustaka media
          tetap tersimpan.
        </p>
        <UAlert
          v-if="galat"
          color="error"
          variant="subtle"
          class="mt-3"
          :description="galat"
        />
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="hapusTarget = null"
            >Batal</UButton
          >
          <UButton color="error" :loading="sibuk" @click="hapus">Hapus</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
