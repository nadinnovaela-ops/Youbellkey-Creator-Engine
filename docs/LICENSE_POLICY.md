# Youbellkey Studio — License Policy & Audit Rules

Dokumen ini mengatur batas hukum penggunaan pustaka, model AI, aset media, dan binary eksternal—baik pada fase pemakaian pribadi saat ini maupun saat renovasi menjadi **produk komersial sekali beli (beli putus)** di Phase 7.

## 1. Klasifikasi Lisensi

| Kategori | Lisensi | Aturan di Youbellkey | Contoh |
| :--- | :--- | :--- | :--- |
| **Hijau** | `MIT`, `Apache-2.0`, `BSD-2-Clause`, `BSD-3-Clause`, `ISC`, `Unlicense` | Boleh dipakai dan dimodifikasi di source/dependency. Wajib mempertahankan copyright & teks lisensi di `THIRD_PARTY_NOTICES.md`. | `hyperframes` (Apache-2.0), `three` (MIT), `zod` (MIT), `next` (MIT), `vitest` (MIT) |
| **Kuning** | `LGPL-2.1`, `LGPL-3.0`, `MPL-2.0` | Boleh dipakai pada produk proprietary dengan syarat batas pemisahan (subprocess CLI atau dynamic linking + memenuhi kewajiban notifikasi/sumber modifikasi library). | FFmpeg build LGPL murni (`--enable-libopenh264`, tanpa `--enable-gpl`) |
| **Merah (Dilarang Embed)** | `AGPL-3.0`, `GPL-2.0`, `GPL-3.0`, `SSPL` | **DILARANG** menyalin source code atau me-link langsung ke aplikasi/installer proprietary. Hanya boleh dijalankan sebagai tool eksternal independen di mesin pengguna (di luar bundle distribusi produk). | `Postiz` (AGPL-3.0), `ComfyUI` (GPL-3.0), `Blender` (GPL-3.0), `Kdenlive` (GPL-3.0), `ffmpeg` build `--enable-gpl` (`libx264`/`libx265`) |
| **Khusus / Evaluasi** | Source-available / Commercial threshold | Tidak boleh menjadi dependency wajib. | `Remotion` (dilarang sebagai dependency inti) |

## 2. Temuan Audit Empiris Lingkungan Awal (2026-11-26)
1. **`hyperframes@0.9.98` (npm):** Lisensi `Apache-2.0` (HeyGen). Dependency inti (`hono`, `esbuild`, `puppeteer-core`, `postcss`, `css-tree`, `undici`, dll.) merupakan ekosistem MIT/Apache/ISC web. Membutuhkan Node.js ≥ 22, headless Chrome/Chromium (`@puppeteer/browsers`), dan `ffmpeg` di `PATH`.
2. **`ffmpeg` Lokal Sistem (`N-128728-g49a3b1f259-20261110`):** Konfigurasi build saat ini mengandung `--enable-gpl --enable-version3 --enable-libx264 --enable-libx265`.
   - **Status Phase 0–6 (Pemakaian Pribadi):** **AMAN** dipanggil sebagai subprocess CLI eksternal (`engines/ffmpeg`) selama tidak didistribusikan ulang.
   - **Kewajiban Phase 7 (Distribusi Beli Putus):** Produk komersial **tidak boleh** membundel binary FFmpeg berflag `--enable-gpl`. Saat packaging komersial, worker harus memakai build LGPL-only atau meminta pengguna menginstal FFmpeg secara terpisah di sistem mereka.
3. **Fallback `edge-tts`:** Hanya diizinkan sebagai fallback opsional untuk eksperimen pribadi tanpa kartu kredit; **dilarang** masuk dalam produk jualan komersial tanpa hak komersial eksplisit.

## 3. Protokol Sebelum Menambah Repository/Dependency Baru
1. Jalankan skill `yb-license-auditor`.
2. Periksa file `LICENSE` root, `package.json` dependency langsung & transitif, lisensi model/weights AI, font, dan aset media.
3. Jalankan `npm run test:license` dan `npm run sbom` untuk memperbarui `THIRD_PARTY_NOTICES.md`.
