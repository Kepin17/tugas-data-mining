# Sistem Prediksi Kelayakan Beasiswa (Decision Tree)

Implementasi end-to-end sesuai `CLAUDE.md`: pembersihan data, model **Decision Tree**, API **FastAPI**, dan frontend **React (Vite) + Tailwind**.

## Struktur Proyek

```
/dataset/   data.csv (mentah), data_clean.csv (hasil pembersihan)
/ml/        train.py — pipeline pembersihan + training + evaluasi
/model/     model.joblib, metadata.json, tree_rules.txt (hasil training)
/backend/   app.py — FastAPI: /predict, /metadata, /tree
/frontend/  React + Vite + Tailwind (landing, form, hasil, pohon keputusan)
/docs/      flowchart, use case diagram, laporan
```

## Fitur Inti & Label

- **Fitur:** IPK, Penghasilan (Rendah/Sedang/Tinggi), Ikut Organisasi (Ikut/Tidak), Ikut UKM (Ikut/Tidak).
- **Label:** `Status Beasiswa` → `Terima` = **Layak (1)**, `Tidak` = **Tidak Layak (0)**.
- Dataset imbalanced (769 Tidak : 272 Terima) → model memakai `class_weight='balanced'` + stratified split, evaluasi per-kelas.

## Cara Menjalankan

### 1. Setup Python (ML + Backend)

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

### 2. Latih model (menghasilkan model/model.joblib)

```bash
.venv/bin/python ml/train.py
```

### 3. Jalankan backend (port 8005)

```bash
.venv/bin/python backend/app.py
# atau: .venv/bin/uvicorn backend.app:app --reload --port 8005
```

### 4. Jalankan frontend (port 3003)

```bash
cd frontend
npm install
npm run dev
```

Buka http://localhost:3003. Request `/api/*` dari frontend otomatis di-proxy ke backend (lihat `frontend/vite.config.js`).

## Endpoint API

| Method | Path        | Keterangan                                                    |
| ------ | ----------- | ------------------------------------------------------------- |
| GET    | `/`         | Health check                                                  |
| GET    | `/metadata` | Fitur, nilai valid, metrik evaluasi                           |
| GET    | `/tree`     | Aturan pohon keputusan (teks)                                 |
| POST   | `/predict`  | Prediksi dari `{ipk, penghasilan, ikut_organisasi, ikut_ukm}` |

Contoh:

```bash
curl -X POST http://127.0.0.1:8005/predict \
  -H "Content-Type: application/json" \
  -d '{"ipk":3.8,"penghasilan":"Rendah","ikut_organisasi":"Ikut","ikut_ukm":"Ikut"}'
```
