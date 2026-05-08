# Gemini AI Face Swap Studio

Web app AI Face Swap modern berbasis **Node.js + Express + Vanilla JS** untuk mengganti wajah pada thumbnail/image target menggunakan portrait yang diupload user. Integrasi AI disiapkan melalui **Gemini 3 Pro Image Preview API** dengan service terpisah agar mudah dipelihara dan dideploy.

## Fitur

- Upload 2 gambar: target/thumbnail dan portrait wajah pengganti.
- Format gambar: JPG, PNG, WEBP.
- Batas ukuran upload via `MAX_FILE_SIZE_MB`.
- Preview gambar sebelum proses.
- Preview portrait crop berbentuk lingkaran.
- Validasi portrait 1 wajah utama di browser jika `FaceDetector` tersedia.
- Prompt tambahan + quick prompt chips.
- Prompt engineering otomatis untuk menjaga pose, lighting, komposisi, background, dan kualitas natural.
- Processing dengan Gemini image generation/editing model.
- Hasil gambar dengan tombol download.
- Compare before/after slider.
- History hasil generate lokal.
- Copy prompt, reset upload, drag & drop upload.
- Loading overlay, progress bar, toast notification, dan retry fallback.
- File cleanup otomatis untuk temp upload dan hasil lama.
- Struktur clean dan scalable.

## Struktur Project

```txt
.
├── controllers/          # Request handlers
├── data/                 # Local JSON history (ignored)
├── middleware/           # Multer upload + error handling
├── public/               # Static public assets placeholder
├── routes/               # Express routes
├── scripts/              # Vanilla JS frontend
├── services/             # Gemini + storage services
├── styles/               # CSS frontend
├── uploads/
│   ├── results/          # Generated images (ignored)
│   └── tmp/              # Temporary uploads (ignored)
├── views/                # HTML views
├── .env.example
├── package.json
└── server.js
```

## Requirements

- Node.js 20+
- Gemini API key dari Google AI Studio

## Setup Gemini API

1. Buka Google AI Studio.
2. Buat API key untuk project Anda.
3. Copy `.env.example` menjadi `.env`.
4. Isi `GEMINI_API_KEY`.
5. Pastikan model tersedia untuk akun/region Anda. Default project ini memakai:

```env
GEMINI_IMAGE_MODEL=gemini-3-pro-image-preview
```

> Catatan: model preview dapat berubah sesuai ketersediaan akun Google/region. Jika akun Anda belum punya akses, ganti `GEMINI_IMAGE_MODEL` dengan model image generation/editing Gemini yang tersedia di project Anda.

## Instalasi

```bash
npm install
cp .env.example .env
npm run dev
```

Buka aplikasi di:

```txt
http://localhost:3000
```

## Environment Variables

| Variable | Default | Keterangan |
| --- | --- | --- |
| `PORT` | `3000` | Port Express server |
| `NODE_ENV` | `development` | Environment runtime |
| `PUBLIC_BASE_URL` | `http://localhost:3000` | Base URL untuk absolute result URL |
| `MAX_FILE_SIZE_MB` | `8` | Maksimal ukuran per gambar |
| `UPLOAD_TTL_MINUTES` | `60` | TTL temp upload sebelum cleanup |
| `RESULT_TTL_MINUTES` | `1440` | TTL file hasil sebelum cleanup |
| `GEMINI_API_KEY` | - | API key Google AI Studio |
| `GEMINI_IMAGE_MODEL` | `gemini-3-pro-image-preview` | Model image Gemini |

## API Endpoints

### `POST /upload`

Upload target dan portrait memakai `multipart/form-data`.

```bash
curl -X POST http://localhost:3000/upload \
  -F "target=@./target.jpg" \
  -F "portrait=@./portrait.jpg"
```

Contoh response:

```json
{
  "success": true,
  "uploadId": "2d54a0d9-0b6d-4ec5-9049-4bb1dbefb77d",
  "message": "Upload berhasil. Gambar siap diproses AI.",
  "files": {
    "target": { "width": 1280, "height": 720, "format": "jpeg" },
    "portrait": { "width": 768, "height": 768, "format": "jpeg" }
  }
}
```

### `POST /generate`

Generate face swap dari `uploadId`.

```bash
curl -X POST http://localhost:3000/generate \
  -H "Content-Type: application/json" \
  -d '{"uploadId":"UPLOAD_ID","prompt":"cinematic lighting, high quality thumbnail"}'
```

Contoh response:

```json
{
  "success": true,
  "message": "Face swap selesai dibuat.",
  "result": {
    "id": "RESULT_ID",
    "url": "/uploads/results/RESULT_ID.png",
    "absoluteUrl": "http://localhost:3000/uploads/results/RESULT_ID.png",
    "model": "gemini-3-pro-image-preview"
  }
}
```

### `GET /result/:id`

Ambil metadata hasil generate.

```bash
curl http://localhost:3000/result/RESULT_ID
```

### `GET /history`

Ambil history hasil generate terbaru.

```bash
curl http://localhost:3000/history
```

### `GET /health`

Health check untuk deployment.

```bash
curl http://localhost:3000/health
```

## Prompt Engineering

Prompt otomatis dibangun di `services/geminiService.js`:

```txt
Replace the face in the target thumbnail with the face from the uploaded portrait while preserving the original pose, lighting, composition, camera angle, expression, cinematic quality, and background. Only change the target face. Keep the body, hair silhouette when appropriate, clothing, background, text, objects, and thumbnail layout intact. Make the result realistic, seamless, detailed, natural, high quality, and free from artifacts.
```

Prompt tambahan user digabung sebagai `Additional user instruction`.

## Security dan Validasi

- Multer membatasi 2 file dan ukuran per file.
- MIME type dibatasi ke JPG, PNG, WEBP.
- Sharp membaca metadata untuk memastikan file benar-benar gambar.
- Nama file temp dibuat dengan UUID untuk mencegah duplicate temp files.
- `.env`, temp upload, hasil generate, dan history lokal di-ignore dari Git.
- Helmet aktif untuk security headers.
- Cleanup job otomatis menghapus upload kedaluwarsa dan hasil lama.

## Deployment

### Vercel

Project ini kompatibel untuk runtime Node.js, tetapi penyimpanan filesystem Vercel bersifat ephemeral. Untuk produksi di Vercel, rekomendasi:

- Simpan hasil ke object storage seperti S3, R2, atau GCS.
- Simpan history ke database seperti Postgres, Redis, atau Firestore.
- Set environment variable di dashboard Vercel.

### Railway

1. Push repo ke GitHub.
2. Buat Railway service dari repo.
3. Set environment variable `GEMINI_API_KEY`, `PUBLIC_BASE_URL`, dan lainnya.
4. Railway akan menjalankan `npm start`.

### VPS Node.js

```bash
npm install --omit=dev
cp .env.example .env
npm start
```

Gunakan process manager seperti PM2 dan reverse proxy Nginx untuk HTTPS.

## Scripts

```bash
npm run dev     # Jalankan development server dengan nodemon
npm start       # Jalankan production server
npm run check   # Syntax check file backend utama
```

## Catatan Produksi

Untuk traffic besar, pindahkan penyimpanan result dari local folder ke object storage, pindahkan `data/history.json` ke database, dan tambahkan rate limiting per IP/user.
