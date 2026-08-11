<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const route = useRoute()
const isNew = computed(() => route.params.id === 'new')
const title = computed(() => (isNew.value ? 'Add Member' : 'Edit Member'))
const saved = ref(false)

const member = reactive({
  name: isNew.value ? '' : 'Maria Santoso',
  email: isNew.value ? '' : 'maria.santoso@email.com',
  password: '',
  phone: isNew.value ? '' : '0812 3456 7890',
  role: isNew.value ? 'user' : 'user',
})

// Pilihan role mengikuti daftar di server/db/schema/users.ts (level kecil = wewenang besar).
const roleOptions = [
  { value: 'master', label: 'Master — level 1' },
  { value: 'admin', label: 'Admin — level 2' },
  { value: 'editor', label: 'Editor — level 3' },
  { value: 'user', label: 'User — level 4' },
]
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <UButton
      to="/admin/members"
      color="secondary"
      variant="link"
      leading-icon="i-lucide-arrow-left"
      class="mb-4 -ml-2"
    >
      Kembali ke Member
    </UButton>

    <div class="mb-7">
      <p class="text-xs font-bold uppercase tracking-[.16em] text-cc-brown-500">Administrasi</p>
      <h1 class="font-serif text-5xl text-cc-green-800">{{ title }}</h1>
    </div>

    <UCard>
      <UForm :state="member" class="space-y-5" @submit="saved = true">
        <UFormField label="Nama lengkap" name="name" required>
          <UInput v-model="member.name" placeholder="Nama member" required class="w-full" />
        </UFormField>

        <UFormField label="Email" name="email" required>
          <UInput v-model="member.email" type="email" placeholder="nama@email.com" required class="w-full" />
        </UFormField>

        <UFormField
          label="Password"
          name="password"
          :required="isNew"
          :hint="isNew ? undefined : 'Kosongkan jika tidak diubah'"
        >
          <UInput
            v-model="member.password"
            type="password"
            placeholder="Password"
            :required="isNew"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Nomor WhatsApp" name="phone" required>
          <UInput v-model="member.phone" placeholder="08xx xxxx xxxx" required class="w-full" />
        </UFormField>

        <UFormField label="Role" name="role" description="Menentukan halaman apa saja yang bisa dibuka.">
          <USelect v-model="member.role" :items="roleOptions" class="w-full" />
        </UFormField>

        <UFormField label="Foto" name="photo" hint="Opsional">
          <UFileUpload accept="image/*" class="w-full" />
        </UFormField>

        <div class="flex items-center gap-4 pt-2">
          <UButton type="submit" color="secondary" size="lg" icon="i-lucide-save">
            Simpan Member
          </UButton>
          <UBadge v-if="saved" color="primary" variant="subtle">Tersimpan (mockup)</UBadge>
        </div>
      </UForm>
    </UCard>
  </div>
</template>
