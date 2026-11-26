# ADR-0003: TypeScript-Native AI Gateway & Pipeline TTS/Whisper Gratis untuk ID & EN

- **Status:** Accepted (2026-11-26)
- **Konteks:** Blueprint awal menyebut LiteLLM (berbasis Python) serta Kokoro TTS (yang kurang mendukung Bahasa Indonesia alami). Proyek kita berbasis TypeScript (Vercel + Node Worker) dan menargetkan konten Bahasa Indonesia & Inggris dengan biaya V1 $0.
- **Keputusan:**
  1. Mengganti LiteLLM proxy Python dengan **TypeScript-Native AI Gateway** (`packages/ai-gateway` + `packages/provider-adapters`) yang mendukung BYOK (Gemini, OpenRouter, Groq, OpenAI, Anthropic) dan pelacakan pemakaian/biaya.
  2. Sinkronisasi subtitle kata-per-kata (ID & EN) memakai **Groq Whisper Free API** (gratis tanpa kartu kredit hingga batas harian Groq).
  3. Voiceover memakai adapter Cloud TTS ber-free-tier resmi (**Google Cloud TTS** / **Azure Speech F0**), dengan opsi fallback `edge-tts` di worker lokal khusus pemakaian pribadi sebelum rilis komersial.
- **Konsekuensi:** Seluruh Control Plane & Worker berjalan murni di runtime TypeScript/Node tanpa container Python tambahan, dan subtitle kata-per-kata untuk Bahasa Indonesia serta Inggris akurat tanpa biaya lisensi awal.
