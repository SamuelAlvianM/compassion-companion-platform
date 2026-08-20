<script setup lang="ts">
definePageMeta({ layout: "admin" });

// Halaman sunting jurnal di dashboard — satu layar untuk "tulis baru" dan
// "sunting", dan satu layar untuk dua peran yang berbeda pekerjaannya:
//
//   ADMIN  menulis/merapikan, MENUGASKAN editor, dan MENERBITKAN.
//   EDITOR memeriksa yang ditugaskan kepadanya: menyetujui atau mengembalikan
//          untuk revisi. Jurnal yang bukan tugasnya tetap bisa dibuka — supaya ia
//          tahu apa yang sedang dikerjakan bersama — tapi terkunci.
//
// Yang menentukan terkunci atau tidak BUKAN halaman ini melainkan server
// (`bolehSunting` di /api/admin/jurnal/[id]), aturannya sama persis dengan yang
// menolak permintaan PATCH. Layar hanya menuruti.

const route = useRoute();
const router = useRouter();
const toast = useToast();
const { user } = useAuth();

const id = computed(() => String(route.params.id));
const baru = computed(() => id.value === "new");
const level = computed(() => user.value?.level ?? 99);
const bolehMenerbitkan = computed(() => level.value <= 2);

/**
 * Benar-benar berperan EDITOR (level 3), bukan "editor ke atas".
 *
 * Dipakai untuk menggambar tombol keputusan redaksi. Sengaja bukan `level <= 3`:
 * kalau begitu, admin ikut melihat "Setujui" dan "Revisi" lagi — persis yang
 * dicabut. Pemeriksaan sebuah peran yang PERSIS jarang benar di kode ini (hampir
 * semuanya "peran ini ke atas"), jadi barisnya diberi penjelasan supaya tidak ada
 * yang merapikannya jadi `<=` di kemudian hari.
 */
const adalahEditor = computed(() => level.value === 3);

/**
 * Siapa yang membuat barisnya. Dipakai untuk memutuskan siapa yang boleh MENGIRIM
 * tulisan ke pemeriksaan.
 *
 * Mengirim adalah pekerjaan PENULIS, bukan pekerjaan siapa pun yang kebetulan
 * punya akses sunting. Tanpa pembedaan ini, editor yang ditugaskan ikut melihat
 * "Kirim hasil revisi" pada tulisan yang justru sedang dikembalikan kepada
 * penulisnya — dan sekali diklik, giliran member terenggut tanpa ia mengerjakan
 * apa pun. Statusnya melompat ke "sedang diperiksa" dengan naskah yang belum ia
 * perbaiki.
 */
const dibuatOleh = ref<string | null>(null);
const milikSaya = computed(
  () => Boolean(dibuatOleh.value) && dibuatOleh.value === user.value?.id,
);

/**
 * Boleh mengirim ke pemeriksaan: admin (yang berdiri sebagai penulis, kadang
 * mewakili member) dan pemilik tulisannya sendiri. Editor yang sedang bertugas
 * memeriksa tidak — pekerjaannya menilai, bukan mengirim.
 */
const bolehMengirim = computed(() => bolehMenerbitkan.value || milikSaya.value);

/**
 * Jurnal ini DITUGASKAN kepada saya sebagai editor.
 *
 * Inilah yang menentukan tergambar-tidaknya "Setujui" dan "Revisi" — BUKAN
 * `bolehSunting`. Keduanya sempat disamakan, dan begitu editor dilarang
 * menyunting (`bolehSunting` selalu false untuk level 3), kedua tombol itu ikut
 * hilang: editor yang sudah ditugaskan membuka halamannya dan tidak menemukan
 * apa pun yang bisa ia lakukan.
 *
 * Pelajarannya: hak MENYUNTING dan hak MEMUTUSKAN adalah dua hal, dan sejak
 * editor kehilangan yang pertama, yang kedua tidak boleh lagi menumpang padanya.
 * Aturan yang sama sudah dipakai server di `KEPUTUSAN_EDITOR`
 * (server/utils/validasi-jurnal.ts): yang berhak memutuskan adalah editor yang
 * `editorId`-nya dirinya sendiri.
 */
const tugasSaya = computed(
  () => adalahEditor.value && Boolean(editorId.value) && editorId.value === user.value?.id,
);

// Penanda "Tugas Anda …" dan "Hanya bisa dibaca" dicabut, atas permintaan.
//
// Keduanya menjelaskan keadaan yang sudah terbaca sendiri dari layar: isian yang
// tidak bisa diketik, dan tombol keputusan yang justru berdiri menyala di kepala
// halaman. Yang tersisa cuma dua chip abu-abu yang menyita baris di dua tempat
// untuk mengulang hal yang sama.

const kosong = () => ({
  judul: "",
  judulEn: "",
  tipe: "",
  kontributor: "",
  kontributorPeran: "",
  userId: "",
  kegiatanId: "",
  ringkasan: "",
  ringkasanEn: "",
  isi: "",
  isiEn: "",
  coverMediaId: "",
});

const form = reactive(kosong());
const coverUrl = ref<string | null>(null);
const statusJurnal = ref<
  "draft" | "review" | "revisi" | "approved" | "published"
>("draft");
const catatanRevisi = ref<string | null>(null);
const editorId = ref("");
const editorNama = ref<string | null>(null);
const bolehSunting = ref(true);
const slug = ref("");
const galat = ref("");
const sibuk = ref(false);
const dicoba = ref(false);

const TIPE = [
  { value: "event-reflection", label: "Event Reflection" },
  { value: "sharing-journey", label: "Sharing Journey" },
  { value: "insight", label: "Insight" },
  { value: "practice", label: "Practice" },
];

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  review: "Minta direview",
  revisi: "Minta direvisi",
  approved: "Disetujui",
  published: "Terbit",
};
const STATUS_WARNA: Record<
  string,
  "neutral" | "warning" | "secondary" | "primary"
> = {
  draft: "neutral",
  review: "warning",
  revisi: "secondary",
  approved: "primary",
  published: "primary",
};

const headerSSR = () =>
  import.meta.server ? useRequestHeaders(["cookie"]) : undefined;

/**
 * Tautan ke event. DIKEMBALIKAN ke formulir sesudah sempat dicabut.
 *
 * Dicabut dulu karena hampir selalu kosong; dikembalikan karena tanpanya sebuah
 * jurnal Event Reflection baru tidak punya jalan sama sekali untuk menyebut event
 * apa yang direfleksikannya — dan nama event itu tergambar di kartu daftar publik
 * (`.journal-event`), tepat di bawah kategorinya. Yang hilang bukan cuma satu
 * kolom di dashboard, melainkan satu baris yang dibaca pengunjung.
 *
 * Boleh kosong untuk kategori apa pun, termasuk Event Reflection: kategorinya bisa
 * dipilih lebih dulu daripada eventnya, dan menolak keadaan sementara yang wajar
 * cuma membuat formulirnya rewel.
 */
const { data: dataKegiatan } = useFetch("/api/admin/kegiatan-pilihan", {
  headers: headerSSR(),
});

/**
 * Nama event yang SEDANG terpasang, diisi saat jurnalnya dimuat.
 *
 * Ada karena daftar pilihan disaring server (hanya yang berlangsung dan yang baru
 * selesai), sementara jurnal lama bisa menunjuk event dari setahun lalu. Kalau
 * nilai itu tidak punya baris yang cocok di daftar, USelectMenu menggambar id
 * mentahnya — dan yang terbaca orang jadi "cck-Fqpt6wiU".
 *
 * Pola yang sama persis dipakai `penulisTanpaAkun` di bawah, dan alasannya juga
 * sama: yang sudah terpasang harus tetap tergambar sebagai pilihan, apa pun isi
 * daftar yang sedang berlaku. Disimpan sebagai nama, bukan dengan meminta server
 * menyertakannya lewat query — permintaan itu berangkat sebelum jurnalnya selesai
 * dimuat, jadi id yang mau disertakan belum diketahui saat dibutuhkan.
 */
const kegiatanTerpasang = ref<{ id: string, judul: string } | null>(null);

/** Sentinel "tidak terkait event". USelectMenu menolak nilai string kosong
    (ComboboxItem melemparkan galat kalau `value=""`), jadi ketiadaan tidak bisa
    diwakili oleh "". Pola dan alasannya sama dengan TANPA_AKUN di bawah. */
const TANPA_EVENT = "__tanpa-event";

/**
 * Pilihan event. Daftarnya SUDAH disaring server: yang sedang berlangsung, plus
 * yang baru selesai dalam batas yang ditentukan di endpointnya. Yang mendatang
 * dan yang batal tidak pernah ikut.
 *
 * Baris kosong di paling atas bukan basa-basi: melepas tautan event adalah
 * tindakan yang sah (kategorinya diubah, atau tautannya memang salah pasang), dan
 * tanpa barisnya satu-satunya jalan melepasnya adalah tidak ada.
 */
const kegiatanOptions = computed(() => {
  const daftar = (dataKegiatan.value?.data ?? []).map((k) => ({
    value: k.id,
    label: k.fase === "berlangsung" ? `${k.label} · berlangsung` : k.label,
  }));

  const terpasang = kegiatanTerpasang.value;
  // Ditandai "sudah lewat" supaya bedanya jelas: baris ini ada karena tulisannya
  // memang sudah tertaut ke situ, bukan karena eventnya masih layak dipilih.
  if (terpasang && !daftar.some((o) => o.value === terpasang.id)) {
    daftar.unshift({
      value: terpasang.id,
      label: `${terpasang.judul} · sudah lewat`,
    });
  }

  return [{ value: TANPA_EVENT, label: "Tidak terkait event" }, ...daftar];
});

/** Nilai yang tergambar di kotaknya: `kegiatanId` kosong berarti sentinelnya. */
const kegiatanPilihan = computed(() => form.kegiatanId || TANPA_EVENT);

const pilihKegiatan = (nilai: string) => {
  form.kegiatanId = nilai === TANPA_EVENT ? "" : nilai;
};

/** Calon editor untuk kotak penugasan. Diambil untuk semua pengelola, bukan hanya
    admin: editor pun melihat nama rekan yang menangani jurnal lain di daftar, dan
    dua sumber nama yang berbeda akan menyimpang. Yang digerbangi admin adalah
    MENUGASKANNYA, dan itu diperiksa server. */
const { data: dataEditor } = useFetch("/api/admin/editors", {
  headers: headerSSR(),
});

/**
 * Nilai penanda untuk pilihan yang artinya "kosong".
 *
 * BUKAN string kosong: `USelectMenu` menolaknya mentah-mentah — "A <ComboboxItem />
 * must have a value prop that is not an empty string" — dan akibatnya bukan cuma
 * baris merah di konsol, melainkan dropdown yang gagal terbuka. Kosongnya
 * diterjemahkan kembali di setter/handler, jadi yang tersimpan tetap "" / null.
 */
const LEPAS_EDITOR = "__lepas";
const TANPA_AKUN = "__tanpa-akun";

const editorOptions = computed(() => [
  { value: LEPAS_EDITOR, label: "Belum ditugaskan" },
  ...(dataEditor.value?.data ?? []).map((e: any) => ({
    value: e.id,
    label: e.nama,
  })),
]);

/** Jembatan antara `editorId` (id sungguhan atau "") dan nilai yang dimengerti
    pemilihnya. Ditulis sebagai computed berpasangan supaya tidak ada dua sumber
    kebenaran untuk satu kotak. */
const editorPilihan = computed({
  get: () => editorId.value || LEPAS_EDITOR,
  set: (nilai: string) => {
    simpanEditor(nilai === LEPAS_EDITOR ? "" : nilai);
  },
});

/** Calon penulis: SELURUH akun aktif, bukan hanya pengelola seperti
    `editorOptions`. Tulisan yang dimasukkan lewat layar ini hampir selalu tulisan
    member — pengelola yang menuliskannya, bukan yang menulisnya. */
const { data: dataPenulis } = useFetch("/api/admin/penulis", {
  headers: headerSSR(),
});

const akunPenulis = computed(() => dataPenulis.value?.data ?? []);

/**
 * Nama penulis yang TIDAK punya akun — pembicara tamu, tulisan lama, atau orang
 * yang menulis sekali lalu tidak pernah mendaftar.
 *
 * Disimpan terpisah dan hanya diisi saat memuat, bukan dihitung dari `form`:
 * kalau ia ikut menghilang begitu admin memilih akun lain, nama aslinya tidak
 * bisa dikembalikan tanpa menutup halaman. Membuka sebuah jurnal tidak boleh
 * menjadi cara kehilangan nama penulisnya.
 */
const penulisTanpaAkun = ref("");

const penulisOptions = computed(() => {
  const akun = akunPenulis.value.map((u: any) => ({
    value: u.id,
    label: u.nama,
  }));
  return penulisTanpaAkun.value
    ? [{ value: TANPA_AKUN, label: penulisTanpaAkun.value }, ...akun]
    : akun;
});

/** Yang sedang terpilih di kotak penulis. `userId` kosong berarti penulisnya
    tidak punya akun — dan itu tetap sebuah pilihan yang tergambar, bukan kotak
    kosong. */
const penulisPilihan = computed(() =>
  form.userId || (penulisTanpaAkun.value ? TANPA_AKUN : undefined),
);

/** Memilih penulis mengubah DUA kolom: `userId` yang menautkannya ke profil, dan
    `kontributor` yang tersimpan sebagai teks. Namanya tetap disimpan apa adanya
    supaya tulisan tidak kehilangan penulis kalau akunnya suatu saat dihapus. */
const pilihPenulis = (nilai: string) => {
  if (nilai === TANPA_AKUN) {
    form.userId = "";
    form.kontributor = penulisTanpaAkun.value;
    return;
  }
  form.userId = nilai;
  form.kontributor =
    akunPenulis.value.find((u: any) => u.id === nilai)?.nama ?? "";
};

/**
 * Menambahkan penulis yang TIDAK punya akun, dengan mengetik namanya.
 *
 * Sebagian penulis memang bukan member: pembicara tamu, orang yang menulis sekali
 * lalu tidak pernah membuka akun, atau nama yang cuma muncul di satu tulisan.
 * Sebelumnya kotak ini hanya menerima nama dari daftar akun, sehingga tulisan
 * seperti itu tidak punya jalan masuk sama sekali — dan yang biasanya terjadi,
 * namanya ditempelkan ke akun orang lain yang kebetulan ada.
 *
 * Yang tersimpan cuma teksnya: `userId` sengaja dikosongkan, bukan diisi id palsu.
 * Kolom `kontributor` di database memang dirancang begitu (lihat komentarnya di
 * server/db/schema/jurnal.ts) — nama bertahan meski tidak ada akun yang
 * menaunginya, dan tidak ada tautan profil yang menjanjikan halaman yang tidak
 * ada.
 *
 * Hanya ditampung di memori halaman ini; tidak ada akun yang dibuat. Nama itu
 * berangkat bersama simpanan berikutnya sebagai teks biasa.
 */
const tambahPenulis = (nama: string) => {
  const bersih = String(nama ?? "").trim();
  if (!bersih) return;
  penulisTanpaAkun.value = bersih;
  form.userId = "";
  form.kontributor = bersih;
};

const pesan = (e: any, bawaan: string) =>
  e?.data?.statusMessage || e?.statusMessage || e?.message || bawaan;

// ── Simpan ───────────────────────────────────────────────────────────────────
// Berdiri DI ATAS `muat()`, bukan di bawahnya. `muat()` memanggil `sidik()` untuk
// mencatat keadaan awal formulir, dan ia dijalankan (`await muat()`) sebelum baris
// mana pun di bawahnya sempat dijalankan — kalau tetap di bawah, yang muncul
// "Cannot access 'tersimpan' before initialization", persis di kepala halaman.
const payload = () => ({
  judul: form.judul.trim(),
  judulEn: form.judulEn.trim() || null,
  tipe: form.tipe || null,
  kontributor: form.kontributor.trim(),
  kontributorPeran: form.kontributorPeran.trim() || null,
  userId: form.userId || null,
  kegiatanId: form.kegiatanId || null,
  ringkasan: form.ringkasan.trim() || null,
  ringkasanEn: form.ringkasanEn.trim() || null,
  isi: form.isi || null,
  isiEn: form.isiEn || null,
  coverMediaId: form.coverMediaId || null,
});

const sidik = () => JSON.stringify(payload());
const tersimpan = ref("");

const keadaanSimpan = ref<
  "diam" | "menunggu" | "menyimpan" | "tersimpan" | "gagal"
>("diam");
let timer: ReturnType<typeof setTimeout> | undefined;

// ── Muat ─────────────────────────────────────────────────────────────────────
const muat = async () => {
  if (baru.value) {
    Object.assign(form, kosong());
    coverUrl.value = null;
    statusJurnal.value = "draft";
    catatanRevisi.value = null;
    editorId.value = "";
    editorNama.value = null;
    bolehSunting.value = true;
    slug.value = "";
    // Penulis dimulai dari yang sedang login — itu kasus yang paling sering —
    // tapi tetap bisa diganti ke akun lain: admin juga memasukkan tulisan orang.
    form.kontributor = user.value?.fullName ?? "";
    form.userId = user.value?.id ?? "";
    penulisTanpaAkun.value = "";
    kegiatanTerpasang.value = null;
    // Yang membuat barisnya adalah yang sedang membuka layar ini.
    dibuatOleh.value = user.value?.id ?? null;
    return;
  }

  sibuk.value = true;
  try {
    // Saat SSR, $fetch tidak ikut membawa cookie peramban — tanpa penerusan ini,
    // endpoint admin selalu menjawab 401 pada render pertama.
    const { data } = await $fetch<{ data: any }>(
      `/api/admin/jurnal/${id.value}`,
      { headers: headerSSR() },
    );
    Object.assign(form, {
      judul: data.judul ?? "",
      judulEn: data.judulEn ?? "",
      tipe: data.tipe ?? "",
      kontributor: data.kontributor ?? "",
      kontributorPeran: data.kontributorPeran ?? "",
      userId: data.userId ?? "",
      kegiatanId: data.kegiatanId ?? "",
      ringkasan: data.ringkasan ?? "",
      ringkasanEn: data.ringkasanEn ?? "",
      isi: data.isi ?? "",
      isiEn: data.isiEn ?? "",
      coverMediaId: data.coverMediaId ?? "",
    });
    penulisTanpaAkun.value = data.userId ? "" : (data.kontributor ?? "");
    // Endpoint detailnya sudah ikut mengirim judul eventnya, jadi tidak perlu
    // permintaan kedua hanya untuk menuliskan satu nama.
    kegiatanTerpasang.value = data.kegiatan
      ? { id: data.kegiatan.id, judul: data.kegiatan.judul }
      : null;
    dibuatOleh.value = data.dibuatOleh ?? null;
    coverUrl.value = data.coverUrl ?? null;
    statusJurnal.value = data.status;
    catatanRevisi.value = data.catatanRevisi ?? null;
    editorId.value = data.editorId ?? "";
    editorNama.value = data.editor?.nama ?? null;
    bolehSunting.value = Boolean(data.bolehSunting);
    slug.value = data.slug;
    tersimpan.value = sidik();
  } catch (e: any) {
    galat.value = pesan(e, "Gagal memuat jurnal.");
  } finally {
    sibuk.value = false;
  }
};

await muat();
watch(id, muat);

// ── Kolom wajib ──────────────────────────────────────────────────────────────
const wajibKosong = belumDiisi;

const kurang = computed(() => {
  const daftar: string[] = [];
  if (!form.judul.trim()) daftar.push("Judul");
  if (!form.kontributor.trim()) daftar.push("Nama penulis");
  return daftar;
});

/** Syarat tambahan saat MENGIRIM ke review — bukan saat menyimpan.
    Draf boleh mengendap tanpa editor; yang tidak boleh adalah mengirimkannya ke
    antrean yang tidak dimiliki siapa pun. */
const kurangUntukReview = computed(() => {
  const daftar = [...kurang.value];
  if (bolehMenerbitkan.value && !editorId.value) daftar.push("Editor");
  return daftar;
});

/** Kategori: tidak menghalangi menyimpan, tapi menghalangi TERBIT. Tulisan titipan
    member lahir tanpa kategori, dan yang menentukannya admin. */
const kategoriKosong = computed(() => !form.tipe);

const simpanSekarang = async () => {
  if (baru.value || !bolehSunting.value) return;
  if (kurang.value.length) {
    keadaanSimpan.value = "diam";
    return;
  }
  if (sidik() === tersimpan.value) {
    keadaanSimpan.value = "diam";
    return;
  }

  const dikirim = sidik();
  keadaanSimpan.value = "menyimpan";
  galat.value = "";
  try {
    await $fetch(`/api/admin/jurnal/${id.value}`, {
      method: "PATCH",
      body: payload(),
    });
    tersimpan.value = dikirim;
    keadaanSimpan.value = "tersimpan";
  } catch (e: any) {
    keadaanSimpan.value = "gagal";
    galat.value = pesan(e, "Gagal menyimpan jurnal.");
  }
};

watch(
  form,
  () => {
    if (baru.value || !bolehSunting.value) return;
    clearTimeout(timer);
    keadaanSimpan.value = "menunggu";
    timer = setTimeout(simpanSekarang, 800);
  },
  { deep: true },
);

onBeforeUnmount(() => clearTimeout(timer));

/**
 * Melahirkan barisnya. Dua tombol memanggilnya dengan maksud berbeda:
 *
 *   "Simpan draft"   -> tersimpan sebagai draft, berhenti di situ
 *   "Minta direview" -> tersimpan LALU langsung masuk antrean editor
 *
 * Yang kedua bukan sekadar pintasan. Tanpanya, admin yang tulisannya sudah siap
 * harus menyimpan, menunggu halaman berpindah, mencari tombol kirim, lalu menekan
 * tombol kedua — tiga langkah untuk satu maksud yang sudah ia putuskan sebelum
 * mulai mengetik. Syarat kelengkapannya tetap berbeda, dan itu yang penting:
 * draft boleh mengendap tanpa editor, yang dikirim ke antrean tidak boleh.
 */
const buatJurnal = async (lanjutReview = false) => {
  dicoba.value = true;
  galat.value = "";

  const belum = lanjutReview ? kurangUntukReview.value : kurang.value;
  if (belum.length) {
    galat.value = lanjutReview
      ? `Lengkapi dulu sebelum dikirim: ${belum.join(", ")}.`
      : `Masih kosong: ${belum.join(", ")}.`;
    return;
  }

  sibuk.value = true;
  try {
    const { data } = await $fetch<{ data: any }>("/api/admin/jurnal", {
      method: "POST",
      // Editor ikut dikirim kalau sudah dipilih di layar ini. Boleh kosong saat
      // menyimpan draft; yang menolak kekosongan cuma jalur "Minta direview".
      body: { ...payload(), editorId: editorId.value || null },
    });

    // Perpindahan status dikerjakan SESUDAH barisnya ada, lewat PATCH terpisah.
    // Endpoint POST hanya tahu melahirkan draft, dan menambah "status" ke sana
    // berarti satu permintaan yang bisa setengah jadi — barisnya lahir tapi
    // statusnya gagal berpindah, tanpa ada yang bisa mengulangnya.
    if (lanjutReview) {
      await $fetch(`/api/admin/jurnal/${data.id}`, {
        method: "PATCH",
        body: { status: "review" },
      });
    }

    toast.add({
      title: lanjutReview ? "Jurnal dikirim untuk direview" : "Draft tersimpan",
      description: `Status saat ini: ${lanjutReview ? STATUS_LABEL.review : STATUS_LABEL.draft}`,
      icon: "i-lucide-check",
      color: "primary",
    });
    await router.replace(`/admin/jurnal/${data.id}`);
  } catch (e: any) {
    galat.value = pesan(e, lanjutReview
      ? "Gagal mengirim jurnal untuk direview."
      : "Gagal menyimpan draft.");
  } finally {
    sibuk.value = false;
  }
};

// ── Penugasan editor ─────────────────────────────────────────────────────────
const simpanEditor = async (nilai: string) => {
  // Di layar "tulis baru" barisnya belum ada, jadi tidak ada yang bisa di-PATCH.
  // Pilihannya cukup disimpan di `editorId` dan ikut berangkat bersama POST.
  if (baru.value) {
    editorId.value = nilai;
    return;
  }

  galat.value = "";
  sibuk.value = true;
  try {
    const { data } = await $fetch<{ data: any }>(
      `/api/admin/jurnal/${id.value}`,
      {
        method: "PATCH",
        body: { editorId: nilai || null },
      },
    );
    editorId.value = data.editorId ?? "";
    editorNama.value =
      editorOptions.value.find((o) => o.value === data.editorId)?.label ?? null;
    toast.add({
      title: "Jurnal telah diperbarui",
      description: data.editorId
        ? `Editor pemeriksa: ${editorNama.value ?? "—"}`
        : "Penugasan editor dilepas",
      icon: "i-lucide-check",
      color: "primary",
    });
  } catch (e: any) {
    galat.value = pesan(e, "Gagal menugaskan editor.");
  } finally {
    sibuk.value = false;
  }
};

// ── Perpindahan status ───────────────────────────────────────────────────────
const modalRevisi = ref(false);
const catatanBaru = ref("");

const pindahStatus = async (tujuan: string, catatan?: string) => {
  galat.value = "";
  sibuk.value = true;
  try {
    clearTimeout(timer);
    // Simpanan terakhir ikut dikirim bersama perpindahan status — hanya bila yang
    // menekan memang berhak menyunting. Editor yang cuma menyetujui tidak ikut
    // menimpa isi tulisan dengan salinan yang ada di layarnya.
    const isiSimpanan = bolehSunting.value ? payload() : {};
    const { data } = await $fetch<{ data: any }>(
      `/api/admin/jurnal/${id.value}`,
      {
        method: "PATCH",
        body: {
          ...isiSimpanan,
          status: tujuan,
          ...(catatan ? { catatanRevisi: catatan } : {}),
        },
      },
    );
    statusJurnal.value = data.status;
    catatanRevisi.value = data.catatanRevisi ?? null;
    slug.value = data.slug;
    if (bolehSunting.value) {
      tersimpan.value = sidik();
      keadaanSimpan.value = "tersimpan";
    }
    modalRevisi.value = false;
    catatanBaru.value = "";
    // Dua baris, bukan satu: yang pertama menyatakan tindakannya berhasil, yang
    // kedua menyatakan tulisan ini sekarang ADA DI MANA. Judul lama (“Status jadi
    // ...”) menggabungkan keduanya jadi satu kalimat setengah, dan yang paling
    // sering dicari orang sesudah menekan tombol — keadaan sekarang — justru yang
    // paling sulit dibaca di situ.
    toast.add({
      title: "Jurnal telah diperbarui",
      description: `Status saat ini: ${STATUS_LABEL[data.status]}`,
      icon: "i-lucide-check",
      color: "primary",
    });
    // Hak sunting bisa BERUBAH mengikuti status (mis. tulisan yang terbit tidak
    // lagi disunting editor), jadi barisnya dibaca ulang dari server.
    await muat();
  } catch (e: any) {
    galat.value = pesan(e, "Gagal mengubah status.");
  } finally {
    sibuk.value = false;
  }
};

const kirimReview = () => {
  dicoba.value = true;
  if (kurangUntukReview.value.length) {
    galat.value = `Lengkapi dulu sebelum dikirim: ${kurangUntukReview.value.join(", ")}.`;
    return;
  }
  pindahStatus("review");
};

const terbitkan = () => {
  if (kategoriKosong.value) {
    dicoba.value = true;
    galat.value =
      "Kategori jurnal belum diisi. Tentukan kategorinya dulu sebelum diterbitkan.";
    return;
  }
  pindahStatus("published");
};

const hapus = async () => {
  if (!confirm("Hapus jurnal ini? Tindakan ini tidak bisa dibatalkan.")) return;
  sibuk.value = true;
  try {
    await $fetch(`/api/admin/jurnal/${id.value}`, { method: "DELETE" });
    await router.push("/admin/jurnal");
  } catch (e: any) {
    galat.value = pesan(e, "Gagal menghapus jurnal.");
  } finally {
    sibuk.value = false;
  }
};

const tabBahasa = ref("id");
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0">
        <NuxtLink
          to="/admin/jurnal"
          class="text-sm text-cc-stone-600 hover:text-cc-brown-500"
        >
          &larr; Kembali
        </NuxtLink>

        <!-- Status duduk sebaris dengan judulnya. Baris penanda sendiri di
             bawahnya membuat kepala halaman jadi tiga tingkat untuk satu hal.
             Slug dicabut: alamatnya sudah bisa dibuka lewat tombol "Lihat", dan
             sebagai teks ia cuma deretan tanda hubung yang tidak pernah dibaca. -->
        <div class="mt-4 flex flex-wrap items-center justify-center gap-4">
          <h1 class="font-serif text-4xl break-words text-cc-green-800">
            {{ baru ? "Tambah Jurnal" : form.judul || "Tanpa judul" }}
          </h1>
          <UBadge
            v-if="!baru"
            :color="STATUS_WARNA[statusJurnal]"
            variant="subtle"
            size="sm"
          >
            {{ STATUS_LABEL[statusJurnal] }}
          </UBadge>
        </div>

        <div v-if="!baru" class="mt-1 flex flex-wrap items-center gap-3">
          <span v-if="editorNama" class="text-xs text-cc-stone-500"
            >ditangani {{ editorNama }}</span
          >
          <IndikatorSimpan v-if="bolehSunting" :keadaan="keadaanSimpan" />
        </div>
      </div>

      <div class="flex shrink-0 flex-wrap items-center gap-2">
        <template v-if="baru">
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-save"
            :loading="sibuk"
            @click="buatJurnal(false)"
          >
            Simpan draft
          </UButton>
          <!-- Berdampingan, dan yang berwarna adalah yang mengantarkan tulisannya
               ke orang berikutnya. "Simpan draft" tetap ada di sebelahnya untuk
               tulisan yang memang belum selesai. -->
          <UButton
            color="secondary"
            icon="i-lucide-send"
            :loading="sibuk"
            @click="buatJurnal(true)"
          >
            Minta direview
          </UButton>
        </template>

        <template v-else>
          <!-- Kirim untuk diperiksa: milik yang menulis.

               Admin memakai kalimat yang SAMA PERSIS dengan yang dibaca member
               di /jurnal-saya ("Kirim hasil revisi"), bukan kalimat sendiri
               ("Kirim ulang"). Di alur ini admin memang berdiri sebagai penulis —
               kadang sebagai dirinya sendiri, kadang mewakili member yang tidak
               sanggup menyelesaikan permintaan editor — dan dua kalimat berbeda
               untuk satu tindakan yang sama membuatnya terbaca seolah dua hal
               yang berbeda. -->
          <UButton
            v-if="
              bolehMengirim &&
              bolehSunting &&
              (statusJurnal === 'draft' || statusJurnal === 'revisi')
            "
            color="secondary"
            icon="i-lucide-send"
            :loading="sibuk"
            @click="kirimReview"
          >
            {{
              statusJurnal === "revisi"
                ? "Kirim hasil revisi"
                : "Kirim untuk diperiksa"
            }}
          </UButton>

          <!-- Keputusan redaksi — MILIK EDITOR SAJA.
               "Setujui" dan "Revisi" tidak lagi digambar untuk admin, atas
               permintaan. Pembagiannya jadi tegas dan terbaca dari layar: editor
               menilai isinya, admin menentukan kapan terbit. Selama keduanya ada
               di tangan admin, tidak ada di layar yang mencegahnya menyetujui
               tulisannya sendiri lalu menerbitkannya semenit kemudian — dan alur
               reviewnya cuma jadi tiga klik.

               Servernya sendiri MASIH mengizinkan admin memutuskan (lihat
               KEPUTUSAN_EDITOR di validasi-jurnal.ts). Itu dibiarkan dengan
               sengaja: kalau editor berhalangan dan pekerjaannya harus jalan,
               jalannya masih ada — hanya tidak lagi ditawarkan sebagai tombol
               yang tinggal dipencet. -->
          <template v-if="tugasSaya">
            <UButton
              v-if="statusJurnal === 'review'"
              color="primary"
              icon="i-lucide-check"
              :loading="sibuk"
              @click="pindahStatus('approved')"
            >
              Setujui
            </UButton>
            <!-- Coklat tua pekat, bukan abu-abu lembut. Berdiri di sebelah
                 "Setujui" yang hijau, keduanya adalah keputusan redaksi dengan
                 bobot yang sama — dan tombol abu-abu di sebelah tombol berwarna
                 terbaca sebagai "batal", bukan sebagai keputusan yang setara. -->
            <UButton
              v-if="statusJurnal === 'review' || statusJurnal === 'approved'"
              color="neutral"
              icon="i-lucide-message-square-warning"
              class="!bg-cc-brown-700 !text-white hover:!bg-cc-brown-800"
              @click="modalRevisi = true"
            >
              Minta direvisi
            </UButton>
          </template>

          <!-- Menerbitkan: admin ke atas.
               Tombolnya digambar SEJAK AWAL dan dimatikan selama belum disetujui,
               bukan disembunyikan sampai syaratnya terpenuhi. Tombol yang tidak
               ada tidak memberi tahu apa pun; tombol yang ada tapi mati sekaligus
               mengatakan "ini langkah berikutnya" dan "belum sekarang" — dan
               alasannya terbaca di tooltipnya. -->
          <UTooltip
            v-if="bolehMenerbitkan && statusJurnal !== 'published'"
            :text="statusJurnal === 'approved' ? 'Terbitkan ke halaman jurnal' : 'Bisa diterbitkan setelah editor menyetujui'"
          >
            <UButton
              color="primary"
              icon="i-lucide-upload"
              :loading="sibuk"
              :disabled="statusJurnal !== 'approved'"
              @click="terbitkan"
            >
              Terbitkan
            </UButton>
          </UTooltip>

          <UButton
            v-if="statusJurnal === 'published' && bolehMenerbitkan"
            color="neutral"
            variant="subtle"
            icon="i-lucide-eye-off"
            :loading="sibuk"
            @click="pindahStatus('draft')"
          >
            Tarik dari publik
          </UButton>

          <UButton
            v-if="statusJurnal === 'published'"
            :to="`/id/jurnal/${slug}`"
            target="_blank"
            color="secondary"
            variant="solid"
            trailing-icon="i-lucide-external-link"
          >
            Lihat
          </UButton>

          <UButton
            v-if="bolehMenerbitkan && statusJurnal !== 'published'"
            color="error"
            variant="ghost"
            icon="i-lucide-trash-2"
            :loading="sibuk"
            @click="hapus"
          >
            Hapus
          </UButton>
        </template>
      </div>
    </div>

    <UAlert
      v-if="galat"
      class="mb-4"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :description="galat"
    />

    <!-- Catatan minta direvisi.
         Tergambar selama catatannya MASIH ADA, bukan hanya selagi statusnya
         "perlu revisi". Begitu penulis mengirim hasil perbaikannya, statusnya
         berpindah ke "sedang diperiksa" — dan dengan syarat lama, catatan yang
         justru harus dibaca ulang editor saat memeriksa hasil revisi menghilang
         tepat pada saat ia paling dibutuhkan.
         Yang membersihkannya server: `catatanRevisi` dikosongkan begitu tulisannya
         disetujui atau terbit, dan ditimpa catatan baru bila revisi diminta lagi.
         Jadi tidak ada catatan basi yang tertinggal di sini. -->
    <div
      v-if="catatanRevisi"
      class="mb-4 rounded-lg border border-cc-stone-200 bg-white/60 p-4"
    >
      <div class="flex items-center gap-2 text-sm font-semibold text-red-700">
        <UIcon name="i-lucide-message-square-warning" class="size-4 shrink-0" />
        Catatan minta direvisi
      </div>
      <p class="mt-1.5 text-sm leading-relaxed whitespace-pre-line text-cc-stone-700">
        {{ catatanRevisi }}
      </p>
    </div>

    <!-- Kategori wajib sebelum terbit. Diberitahukan sejak sekarang, bukan saat
         tombol Terbitkan ditekan: tulisan titipan member selalu datang tanpa
         kategori, dan yang menentukannya admin. -->
    <UAlert
      v-if="!baru && kategoriKosong"
      class="mb-4"
      color="warning"
      variant="subtle"
      icon="i-lucide-tag"
      title="Kategori belum diisi"
      description="Tentukan kategori dan Editor yang akan ditugaskan untuk memeriksa jurnal"
    />

    <UCard class="mb-6">
      <!-- Penanda terkunci duduk di pojok kanan atas TIAP kotak, bukan sekali di
           baris tombol. Alasan kenapa sebuah isian tidak bisa diubah harus berada
           di kotak yang sedang dicoba diubah orangnya — baris tombol di kepala
           halaman sudah tergulir ke atas begitu orang sampai di kotak kedua. -->
      <div class="grid gap-4 sm:grid-cols-2">
        <!-- Urutan barisnya mengikuti urutan keputusan, bukan urutan kolom di
             database: baris pertama menempatkan tulisan ini SEBAGAI APA
             (kategori) dan TENTANG APA (event), baris kedua menempatkan SIAPA
             yang menulis dan SIAPA yang memeriksa. Dua pertanyaan tentang isi,
             lalu dua pertanyaan tentang orang. -->
        <UFormField
          label="Kategori jurnal"
          required
          :error="dicoba && kategoriKosong ? 'Belum diisi' : undefined"
        >
          <USelect
            v-model="form.tipe"
            :items="TIPE"
            value-key="value"
            :disabled="!bolehSunting"
            placeholder="Pilih kategori"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Event terkait">
          <USelectMenu
            :model-value="kegiatanPilihan"
            :items="kegiatanOptions"
            value-key="value"
            :disabled="!bolehSunting"
            placeholder="Tidak terkait event"
            :search-input="{ placeholder: 'Cari nama event…' }"
            class="w-full"
            @update:model-value="pilihKegiatan"
          />
        </UFormField>

        <!-- Penulis DIPILIH dari daftar akun, ATAU diketik sebagai nama baru.
             Tulisan yang lahir di layar ini biasanya tulisan admin sendiri —
             karena itu isian awalnya nama yang sedang login — tapi admin juga
             memasukkan tulisan orang lain, termasuk orang yang tidak punya akun
             di situs ini: pembicara tamu, penulis sekali jalan, atau nama yang
             hanya muncul di satu tulisan.

             Nama yang datang dari akun ikut menautkan tulisan ke profil orangnya
             (`userId`); nama yang diketik hanya tersimpan sebagai teks. Keduanya
             sah, dan bedanya disimpan apa adanya, bukan dipaksa jadi salah satu. -->
        <UFormField
          label="Penulis"
          required
          :error="wajibKosong(form.kontributor, dicoba)"
        >
          <USelectMenu
            :model-value="penulisPilihan"
            :items="penulisOptions"
            value-key="value"
            :disabled="!bolehSunting"
            placeholder="Pilih atau ketik nama penulis"
            :search-input="{ placeholder: 'Cari nama, atau ketik nama baru…' }"
            create-item="always"
            class="w-full"
            @create="tambahPenulis"
            @update:model-value="pilihPenulis"
          >
            <!-- Nuxt UI menuliskan baris ini sebagai `Create "…"`. Seluruh layar
                 ini berbahasa Indonesia, dan satu baris Inggris di tengah daftar
                 nama terbaca seperti pesan sistem, bukan pilihan yang bisa
                 ditekan. -->
            <template #create-item-label="{ item }">
              Pakai nama baru: <strong>{{ item }}</strong>
            </template>
          </USelectMenu>
        </UFormField>

        <!-- Memilih editor: admin saja. Penulisnya tidak pernah melihat kolom
             ini — nama editornya sengaja tidak sampai ke layar member.

             Tergambar juga di layar "tulis baru", bukan hanya sesudah drafnya
             jadi: admin yang sudah tahu siapa yang akan memeriksa tidak perlu
             kembali ke formulir yang sama untuk satu isian. Boleh dikosongkan di
             sini — yang menolak kekosongan itu "Kirim untuk diperiksa". -->
        <UFormField
          v-if="bolehMenerbitkan"
          label="Pilih editor"
          required
          :error="!editorId && dicoba && !baru ? 'Belum ditugaskan' : undefined"
        >
          <USelectMenu
            v-model="editorPilihan"
            :items="editorOptions"
            value-key="value"
            placeholder="Belum ditugaskan"
            :search-input="{ placeholder: 'Cari nama editor…' }"
            class="w-full"
          />
        </UFormField>

        <!-- Gambar sampul DINONAKTIFKAN sementara.
             Alasannya bukan bugnya, melainkan kartu di /id/jurnal yang memang
             belum pernah menggambar thumbnail — endpointnya sudah mengirim
             `coverUrl`, tapi templatnya tidak memakainya. Selama itu belum
             dipasang, kolom ini menjanjikan sesuatu yang tidak pernah dilihat
             siapa pun kecuali di kepala artikel.
             Kolom `cover_media_id`, endpoint, dan `GambarField` tetap utuh:
             kembalikan blok ini begitu kartunya siap menggambar sampul.
        <div class="sm:col-span-2">
          <GambarField
            :url="coverUrl"
            label="Gambar sampul"
            petunjuk="opsional — tampil di kepala artikel"
            :rasio="16 / 9"
            :lebar-pratinjau="320"
            @terpasang="
              ({ mediaId, url }) => {
                form.coverMediaId = mediaId;
                coverUrl = url;
              }
            "
            @dilepas="
              () => {
                form.coverMediaId = '';
                coverUrl = null;
              }
            "
          />
        </div>
        -->
      </div>
    </UCard>

    <UCard>
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="font-serif text-2xl text-cc-green-800">Isi tulisan</h2>
          <div class="flex flex-wrap items-center gap-3">
            <!-- Penanda yang sama seperti di kotak pertama; di kotak ini ia
                 menumpang baris kepala yang memang sudah ada. -->
            <UTabs
              v-model="tabBahasa"
              size="sm"
              :items="[
                { value: 'id', label: 'Indonesia' },
                { value: 'en', label: 'English (opsional)' },
              ]"
              :content="false"
            />
          </div>
        </div>
      </template>

      <div v-show="tabBahasa === 'id'" class="space-y-4">
        <!-- Judul duduk di sini, bukan di kartu identitas di atas.
             Judul adalah bagian dari TULISANNYA, sejajar dengan sub judul dan
             badan naskah — bukan sejajar dengan kategori, event, dan penulis yang
             menempatkan tulisan itu di dalam sistem. Selain itu versi Inggrisnya
             memang sudah sejak awal berada di tab sebelah; dengan judul Indonesia
             di atas dan judul Inggris di sini, satu isian yang sama terpecah ke
             dua kotak yang berjauhan. -->
        <UFormField
          label="Judul"
          required
          :error="wajibKosong(form.judul, dicoba)"
        >
          <UInput
            v-model="form.judul"
            :disabled="!bolehSunting"
            placeholder="Judul tulisan"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Sub Judul">
          <UTextarea
            v-model="form.ringkasan"
            :disabled="!bolehSunting"
            :rows="2"
            autoresize
            :maxrows="4"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Tuliskan isi jurnal di sini:">
          <JurnalEditor v-model="form.isi" :terkunci="!bolehSunting" />
        </UFormField>
      </div>

      <div v-show="tabBahasa === 'en'" class="space-y-4">
        <UFormField label="Judul (EN)">
          <UInput
            v-model="form.judulEn"
            :disabled="!bolehSunting"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Sub Judul (EN)">
          <UTextarea
            v-model="form.ringkasanEn"
            :disabled="!bolehSunting"
            :rows="2"
            autoresize
            :maxrows="4"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Tuliskan versi Inggrisnya di sini:">
          <JurnalEditor
            v-model="form.isiEn"
            :terkunci="!bolehSunting"
            placeholder="Kosongkan bila tidak ada versi Inggrisnya."
          />
        </UFormField>
      </div>
    </UCard>

    <UModal v-model:open="modalRevisi" title="Minta revisi">
      <template #body>
        <UFormField label="Catatan untuk penulis" required>
          <UTextarea
            v-model="catatanBaru"
            :rows="4"
            class="w-full"
            placeholder="Apa yang perlu diperbaiki sebelum tulisan ini terbit?"
          />
        </UFormField>
        <p class="mt-2 text-xs text-cc-stone-500">
          Penulis akan melihat catatan dari Anda sebagai anonim.
        </p>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="modalRevisi = false"
            >Batal</UButton
          >
          <UButton
            color="secondary"
            :disabled="!catatanBaru.trim()"
            :loading="sibuk"
            @click="pindahStatus('revisi', catatanBaru.trim())"
          >
            Kembalikan untuk revisi
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
