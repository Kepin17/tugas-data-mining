# CLAUDE.md — Sistem Prediksi Kelayakan Beasiswa

Dokumen ini menjadi konteks kerja bagi Claude (dan anggota tim) saat membantu pengembangan proyek **Sistem Prediksi Kelayakan Penerima Beasiswa** berbasis machine learning (Decision Tree) dengan antarmuka website.

## 1. Ringkasan Proyek

Proyek ini membangun sebuah website yang dapat memprediksi apakah seorang mahasiswa **Layak** atau **Tidak Layak** menerima beasiswa, berdasarkan data akademik dan sosial-ekonomi mahasiswa. Model prediksi dibangun menggunakan algoritma **Decision Tree** dan diintegrasikan ke backend website agar dapat diakses melalui form input sederhana.

## 2. Dataset

File: `data.csv` (1.043 baris data mahasiswa, 15 kolom)

### 2.1 Kolom dataset

| Kolom | Tipe | Keterangan |
|---|---|---|
| No | Integer | Nomor urut |
| Nama Lengkap | Teks | Identitas mahasiswa (sebaiknya tidak dipakai sebagai fitur model) |
| Prodi | Kategorikal | Program studi (18 prodi unik; ada 1 baris kotor berisi nilai `"prodi"` yang harus dibuang) |
| Jenis Kelamin | Kategorikal | `L` / `P` |
| Jarak Tempat Tinggal ke Kampus (Km) | Kategorikal | `Dekat` / `Jauh` |
| Asal Sekolah | Teks | Nama sekolah asal |
| Tahun Lulus | Integer | 2018–2020 |
| SKS | Integer | Jumlah SKS yang sudah ditempuh (18–24) |
| **Ikut Organisasi** | Kategorikal | `Ikut` / `Tidak` — **fitur inti** |
| **Ikut UKM** | Kategorikal | `Ikut` / `Tidak` — **fitur inti** |
| **IPK** | Numerik | Skala 0.42–3.91 — **fitur inti** |
| Pekerjaan Orang Tua | Kategorikal | Sangat bervariasi (171 nilai unik, lihat catatan kualitas data) |
| **Penghasilan** | Kategorikal | `Rendah` / `Sedang` / `Tinggi` — proxy untuk **pendapatan orang tua**, **fitur inti** |
| Tanggungan | Integer | Jumlah tanggungan keluarga (1–5) |
| **Status Beasiswa** | Kategorikal | `Terima` / `Tidak` — **label target (y)** |

### 2.2 Variabel inti yang disepakati tim (per arahan)

Empat variabel utama yang dipakai sebagai fitur prediksi:
1. **IPK**
2. **Penghasilan Orang Tua**
3. **Ikut Organisasi**
4. **Ikut UKM**

Variabel lain (Prodi, Jenis Kelamin, Jarak, Asal Sekolah, Tahun Lulus, SKS, Pekerjaan Orang Tua, Tanggungan) bersifat opsional/pendukung — Anggota 1 yang menentukan final apakah ada fitur tambahan yang relevan secara domain.

### 2.3 Label target

`Status Beasiswa` → dipetakan menjadi label biner:
- `Terima` → **Layak**
- `Tidak` → **Tidak Layak**

Distribusi kelas: 770 "Tidak" vs 272 "Terima" — **dataset tidak seimbang (imbalanced)**, perlu diperhatikan saat training (misalnya dengan `class_weight='balanced'`, stratified split, atau resampling).

### 2.4 Catatan kualitas data (penting untuk Anggota 1)

- Ada 1 baris kosong total di akhir file (baris terakhir, semua nilai NaN) — harus di-drop.
- Ada 1 baris dengan `Prodi = "prodi"` (header yang ikut ter-input sebagai data) — harus dibuang.
- Kolom `Pekerjaan Orang Tua` bercampur antara kategori asli (Wiraswasta, Petani, PNS, Buruh, Pedagang, Karyawan Swasta, Pensiunan, Nelayan, dll.) dan ratusan judul pekerjaan generik/asing (mis. "Software Test Engineer I", "VP Marketing", "Geological Engineer") yang tampak seperti data sintetis/dummy tambahan. Jika kolom ini dipakai sebagai fitur, perlu disederhanakan jadi kategori besar (mis. "Wiraswasta/Petani/PNS/Buruh/Pedagang/Lainnya") agar tidak menyebabkan high-cardinality encoding yang berlebihan.
- Beberapa baris di bagian akhir dataset memiliki pola nama dan asal sekolah yang tidak konsisten dengan baris-baris awal (kemungkinan data tambahan/augmentasi) — perlu di-screening saat exploratory data analysis.
- Encoding file: `latin-1` / `ISO-8859-1` (bukan UTF-8 murni), perlu diperhatikan saat `pd.read_csv()` (gunakan `encoding='latin1'` atau bersihkan dulu).

## 3. Pembagian Tim (4 Orang)

### Anggota 1 — Analisis Kebutuhan dan Dataset
**Tugas:**
- Menentukan kriteria penerimaan beasiswa
- Menentukan variabel yang digunakan (lihat §2.2)
- Menyiapkan dan membersihkan dataset (lihat §2.4)
- Menentukan label target (Layak / Tidak Layak)
- Membuat flowchart, use case diagram, dan dokumentasi

**Output:**
- Dataset siap pakai (bersih, sudah di-encode/sudah final kolom)
- Flowchart sistem
- Use case diagram

### Anggota 2 — Implementasi Algoritma Decision Tree
**Tugas:**
- Preprocessing data (encoding kategorikal, scaling jika perlu, split train/test)
- Membuat model Decision Tree
- Melatih model
- Menguji akurasi model
- Menyiapkan model agar dapat dipanggil oleh website (serialisasi model, mis. `joblib`/`pickle`, dan endpoint API)

**Tools:** Python, Pandas, Scikit-learn

**Output:**
- Model prediksi (file `.pkl` / `.joblib`)
- Metrik evaluasi: Accuracy, Precision, Recall, F1-Score (dengan perhatian khusus pada imbalance kelas — sertakan confusion matrix dan classification report per kelas)

### Anggota 3 — Frontend Website
**Tugas:**
- Membuat tampilan landing page
- Membuat form input data mahasiswa
- Membuat halaman hasil prediksi
- Membuat halaman visualisasi pohon keputusan

**Tools:** Next.js atau React, Tailwind CSS

**Output:**
- Tampilan website yang interaktif

### Anggota 4 — Backend dan Integrasi Sistem
**Tugas:**
- Membuat API
- Menghubungkan frontend dengan model Python (model dari Anggota 2)
- Mengelola proses prediksi
- Melakukan testing sistem
- Deploy aplikasi

**Tools:** Express.js / FastAPI / Flask

**Output:**
- Sistem berjalan end-to-end

## 4. Tech Stack (berdasarkan rencana proyek)

- **Machine Learning:** Python, Pandas, Scikit-learn
- **Frontend:** Next.js atau React, Tailwind CSS
- **Backend/API:** Express.js / FastAPI / Flask (untuk serving model Decision Tree)

## 5. Alur Sistem (Ringkas)

1. User mengisi form (IPK, Penghasilan Orang Tua, Ikut Organisasi, Ikut UKM, dst.)
2. Frontend mengirim data ke backend API
3. Backend memuat model Decision Tree yang sudah dilatih, melakukan preprocessing input sesuai pipeline training
4. Model mengembalikan prediksi: **Layak** / **Tidak Layak**
5. Frontend menampilkan hasil ke user

## 6. Catatan untuk Claude saat membantu proyek ini

- Saat membuat/mengubah kode preprocessing, selalu konsisten dengan pemetaan label di §2.3 (`Terima → Layak/1`, `Tidak → Tidak Layak/0`).
- Saat membangun pipeline training, ingatkan soal imbalance kelas (§2.3) dan sertakan evaluasi per kelas, bukan hanya akurasi keseluruhan.
- Saat membersihkan dataset, ikuti catatan kualitas data di §2.4 sebelum melakukan feature engineering.
- Struktur folder yang disarankan untuk proyek (jika belum ada):
  ```
  /dataset/        -> data.csv, data_clean.csv
  /notebooks/       -> eksplorasi & training model (Jupyter/Colab)
  /model/           -> model.pkl, preprocessing pipeline
  /backend/         -> Flask/FastAPI app, endpoint /predict
  /frontend/        -> React/Next.js app
  /docs/            -> flowchart, use case diagram, laporan
  ```
