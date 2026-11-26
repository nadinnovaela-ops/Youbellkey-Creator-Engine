# ADR-0002: HyperFrames sebagai Master Renderer dengan Template-Driven `YB Video Document`

- **Status:** Accepted (2026-11-26)
- **Konteks:** Blueprint awal ingin `YB Video Document` JSON bisa menukar langsung mesin antara HyperFrames, Motion Canvas, Manim, dan Blender, sekaligus membiarkan LLM menulis kode HTML/JS bebas per video. Di sisi lain, Remotion memiliki syarat lisensi komersial berbayar di atas batas gratisnya.
- **Keputusan:**
  1. **HyperFrames (`Apache-2.0`)** ditetapkan sebagai satu-satunya master timeline renderer (`1080x1920`, `9:16` V1). Remotion bukan dependency wajib.
  2. `YB Video Document` bersifat **Template-Driven + Clip Layering** untuk 2 jalur inti V1:
     - Jalur A: Motion Graphics, Kinetic Typography, Data Chart, & Three.js Explainer berparameter.
     - Jalur B: AI Visual Storytelling / Dokumenter (AI Image + gerak kamera + word-synced captions).
  3. Mesin lanjutan (`engines/manim`, `engines/motion-canvas`, ComfyUI) di masa depan bertindak sebagai **penghasil klip media (`.mp4`/`.png`)** yang masuk ke layer `YB Video Document`, bukan mengganti HyperFrames sebagai timeline compiler.
- **Konsekuensi:** Video stabil bebas error sintaks JS acak, proyek dapat diedit langsung dari form HP PWA, dan arsitektur tetap terbuka terhadap klip 3D/sains di fase lanjut.
