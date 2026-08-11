<script setup lang="ts">
// Rangka halaman detail event.
//
// Menirukan `.event-detail-grid`: sampul + panel informasi di kiri, panel
// pendaftaran di kanan. Kepala halamannya ikut dirangkai karena judul event
// termasuk bagian yang paling terlihat hilang saat berpindah bahasa.
</script>

<template>
  <main class="event-page" aria-hidden="true">
    <div class="container">
      <div class="page-head">
        <USkeleton class="h-3 w-40" />
        <USkeleton class="mt-4 h-3 w-56" />
        <USkeleton class="mt-4 h-12 w-3/4 max-w-2xl" />
        <USkeleton class="mt-4 h-4 w-2/3 max-w-xl" />
      </div>

      <div class="event-detail-grid">
        <section class="event-overview">
          <USkeleton class="aspect-[16/9] w-full rounded-lg" />

          <div class="event-information panel">
            <USkeleton class="h-3 w-32" />
            <div class="mt-4 grid grid-cols-3 gap-4">
              <div v-for="n in 3" :key="n">
                <USkeleton class="h-3 w-16" />
                <USkeleton class="mt-2 h-4 w-full" />
              </div>
            </div>
            <USkeleton class="mt-6 h-8 w-3/4" />
            <div class="mt-3 space-y-2">
              <USkeleton class="h-3 w-full" />
              <USkeleton class="h-3 w-11/12" />
              <USkeleton class="h-3 w-3/5" />
            </div>
          </div>
        </section>

        <div>
          <section class="registration panel">
            <USkeleton class="h-3 w-40" />
            <USkeleton class="mt-3 h-10 w-2/3" />
            <div class="mt-3 space-y-2">
              <USkeleton class="h-3 w-full" />
              <USkeleton class="h-3 w-4/5" />
            </div>
            <div class="mt-5 space-y-4">
              <div v-for="n in 3" :key="n">
                <USkeleton class="h-3 w-28" />
                <USkeleton class="mt-2 h-9 w-full rounded-md" />
              </div>
              <USkeleton class="h-10 w-full rounded-md" />
            </div>
          </section>
        </div>
      </div>
    </div>
  </main>
</template>
