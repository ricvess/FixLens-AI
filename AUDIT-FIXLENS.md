# FixLens AI — Laporan Audit (bug, keamanan, rekomendasi)

Dibuat 20 November 2026. Cakupan: `index.html`, `script.js`, `style.css`.
Yang **tidak** bisa saya lihat: Edge Function `diagnose`, setting Supabase, dan hosting. Bagian itu ditandai "perlu kamu cek".

## A. Sudah saya kerjakan di kode

### Rebrand
- Semua "FixIt AI" menjadi "FixLens AI" (HTML, JS, CSS, judul, meta, pesan error, nama file ekspor).
- Key localStorage: `fixit-theme/lang` menjadi `fixlens-theme/lang`, dengan migrasi otomatis (preferensi user lama tidak hilang).
- Logo baru di-vektorisasi dari gambar yang kamu kirim: `assets/` berisi SVG + PNG HD (full terang/gelap, header, ikon, favicon, apple-touch, icon 192/512, OG image 1200x630).
- Font body diganti ke Manrope (sesuai brand sheet), DM Sans dihapus. Token warna brand ditambahkan di CSS (`--brand-teal/green/coral/navy`).

### Bug yang diperbaiki
| # | Bug | Dampak |
|---|-----|--------|
| 1 | Link reset password tidak punya layar "buat password baru" (event `PASSWORD_RECOVERY` tidak ditangani) | User klik link email, langsung login tanpa bisa ganti password |
| 2 | `redirectTo` memakai `origin` saja | Di GitHub Pages sub-folder, link email nyasar ke root |
| 3 | Selector terjemahan `[data-dashboard-view="overview"] span` kena logo sidebar | Mode Indonesia menimpa teks brand dengan "Ringkasan" |
| 4 | Handler keyboard upload-zone memanggil `preventDefault()` untuk semua tombol di dalamnya | Enter/Spasi pada tombol kamera malah membuka file picker |
| 5 | Riwayat chat tidak pernah di-reset antar diagnosis | Percakapan hasil lama ikut terkirim ke AI untuk hasil baru; chat hilang saat hasil di-render ulang |
| 6 | Kirim chat bisa dobel (tidak ada guard), tanpa timeout, error 429 diam-diam diganti jawaban palsu | Biaya ganda, UI menggantung |
| 7 | Jawaban fallback (harga Rp, dll.) tampil seolah dari AI | Menyesatkan; sekarang diberi label "panduan umum offline" |
| 8 | Logout gagal total kalau offline | User tidak bisa keluar; sekarang fallback ke logout lokal |
| 9 | Drop file di luar upload-zone membuat browser pindah ke gambar | Sekarang dicegah |
| 10 | Diagnosis lama dari database tidak dinormalisasi saat ditampilkan | Bisa muncul `urgency-undefined`; sekarang dinormalisasi |
| 11 | Sinyal teks miring (`*Tips:*`) tampil dengan tanda bintang | Sekarang dirender miring |
| 12 | Listener `onAuthStateChange` didaftarkan setelah `getSession` | Event awal bisa terlewat |

### Keamanan yang ditambahkan
- Content-Security-Policy (meta), `referrer` policy, script inline dipindah ke `theme-init.js`, inline style dihapus (agar CSP bisa ketat).
- `supabase-js` di-pin ke `2.81.1` (sebelumnya `@2` mengambang).
- Password minimal 8 karakter (sebelumnya 6).
- Foto selalu di-encode ulang lewat canvas, sehingga **EXIF/GPS lokasi terhapus** sebelum upload.
- Ekspor CSV: perlindungan *formula injection* (`=`, `+`, `-`, `@`) karena AI membaca teks dari foto, plus BOM UTF-8.
- Chat: batas 500 karakter, riwayat maks 10 pesan, timeout 30 detik, `diagnosis_id` dikirim agar server bisa memuat konteks sendiri.
- `supabase-security.sql`: RLS tabel, bucket privat + batas ukuran/tipe, policy per-folder user, kuota harian AI.

Temuan baik: XSS sudah ditangani dengan benar (`escapeHTML` dipakai konsisten), tidak ada secret key di klien (key `sb_publishable_...` memang publik).

## B. Perlu kamu lakukan (saya tidak bisa dari sini)

**Prioritas tinggi**
1. Jalankan `supabase-security.sql` di SQL Editor, lalu uji dengan dua akun: akun B tidak boleh bisa membaca data/foto akun A.
2. Pastikan bucket `diagnosis-images` **Private**.
3. Edge Function `diagnose`: ikuti `supabase-edge-function-checklist.ts` (verifikasi JWT, kuota, validasi input, konteks chat dari DB, CORS bukan `*`).
4. Supabase Auth, URL Configuration: daftarkan URL situs persis (termasuk sub-folder) di *Site URL* dan *Redirect URLs*.
5. Auth, Providers, Email: aktifkan konfirmasi email, naikkan minimum password ke 8+, aktifkan leaked-password protection (butuh plan Pro) dan CAPTCHA (Turnstile/hCaptcha) untuk signup/reset.

**Prioritas menengah**
6. Header HTTP: GitHub Pages tidak bisa set header. Taruh Cloudflare (gratis) di depan untuk `frame-ancestors 'none'` (anti-clickjacking), HSTS, `X-Content-Type-Options: nosniff`. CSP via meta tidak mendukung `frame-ancestors`.
7. Self-host Lucide dan font Manrope (sekarang dari unpkg/Google). Jika tidak, tambahkan atribut SRI pada script CDN.
8. Halaman Privacy Policy + Terms, dan fitur hapus akun/hapus semua data (UU PDP Indonesia): foto rumah bisa berisi wajah, alamat, dokumen.
9. Logging server: jangan simpan body request (berisi foto) dan token.

## C. Saran pengembangan

**Diubah / diganti**
- Bahasa UI: sekarang campuran. Hanya ±35 string yang diterjemahkan, sisanya Inggris, padahal default `id`. Pilih satu: Inggris penuh (hapus toggle) atau terjemahkan semua lewat atribut `data-i18n`.
- Warna UI masih palet hijau sage lama. Brand sheet memakai teal `#00C2C2` / hijau `#2ECC71` / `#FC515C`. Catatan: "Insight Orange" `#FC515C` sebenarnya merah-koral, bukan oranye, sebaiknya salah satunya dikoreksi di brand sheet.
- Tanggal selalu format `en`; ikuti bahasa aktif.
- `script.js` 2000+ baris dalam satu file: pecah per modul (auth, scanner, chat, history, i18n).

**Ditambahkan**
- Modal: focus trap + kembalikan fokus ke tombol pemicu (aksesibilitas).
- Konfirmasi password / meter kekuatan password saat daftar.
- Login sosial (Google) untuk mengurangi friksi dan risiko password lemah.
- Loading skeleton + retry otomatis untuk upload gagal; PWA offline shell (manifest sudah ditambahkan).
- Pagination riwayat (sekarang limit 100) dan pencarian di server.
- Tes otomatis (Playwright) untuk alur login, reset password, scan, hapus.
- Analytics yang menghormati privasi (Plausible) dan monitoring error (Sentry) dengan scrubbing foto.

**Dikembangkan**
- Estimasi biaya perbaikan yang nyata (per kota/negara) dari data terkurasi, bukan angka tetap.
- Mode multi-foto per kasus, dan perbandingan sebelum/sesudah perbaikan.
- Rekomendasi tukang/toko terdekat dan link ke tutorial video.
- Disclaimer keselamatan yang lebih menonjol untuk kategori listrik, gas, dan struktur bangunan (urgensi `critical` sebaiknya menampilkan nomor darurat lokal).

## D. Cara uji setelah deploy
1. Buka DevTools, Console: pastikan tidak ada pelanggaran CSP ("Refused to ...") saat memuat landing, login, scan, dan chat. Jika ada, tambahkan host terkait di meta CSP.
2. Alur reset password dari email sampai berhasil ganti password.
3. Scan foto dari galeri, lalu cek di Storage bahwa file tidak membawa EXIF.
4. Login dua akun berbeda dan coba akses data akun lain (harus gagal).
5. Ganti tema terang/gelap: logo harus berganti, favicon tampil.

## Catatan logo
Logo di-trace dari JPG yang kamu kirim (kata "FixLens AI" ±830 px lebar), jadi vektornya setia pada gambar tapi ada sedikit pembulatan sudut. Untuk master cetak (spanduk, kartu nama), sebaiknya minta file asli dari desainer / generator, atau saya bisa rebuild wordmark memakai font Manrope asli jika file font-nya kamu unggah.
