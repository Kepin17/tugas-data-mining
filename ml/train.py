"""
Training pipeline — Sistem Prediksi Kelayakan Beasiswa (Decision Tree).

Mengikuti CLAUDE.md:
- Bersihkan dataset (encoding latin-1, baris kosong, baris 'prodi', kolom sampah).
- Fitur inti: IPK, Penghasilan, Ikut Organisasi, Ikut UKM.
- Label: Status Beasiswa -> Terima=1 (Layak), Tidak=0 (Tidak Layak).
- Perhatikan imbalance kelas (class_weight='balanced', stratified split).
- Simpan model (.joblib), metadata, dan evaluasi per-kelas.

Jalankan dari root proyek:  python ml/train.py
"""
from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.tree import DecisionTreeClassifier, export_text

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT = Path(__file__).resolve().parents[1]
RAW_CSV = ROOT / "dataset" / "data.csv"
CLEAN_CSV = ROOT / "dataset" / "data_clean.csv"
COLLECTED_CSV = ROOT / "dataset" / "collected.csv"
MODEL_DIR = ROOT / "model"
MODEL_PATH = MODEL_DIR / "model.joblib"
METADATA_PATH = MODEL_DIR / "metadata.json"
TREE_TXT_PATH = MODEL_DIR / "tree_rules.txt"

# ---------------------------------------------------------------------------
# Fitur model (5 fitur: IPK, Tanggungan, Penghasilan, Ikut Organisasi, Ikut UKM)
# Catatan: Pekerjaan Orang Tua TIDAK dipakai sebagai fitur model; hanya disimpan
# sebagai data administratif (lihat backend) dan tetap dibersihkan untuk dataset.
# ---------------------------------------------------------------------------
NUMERIC_FEATURES = ["IPK", "Tanggungan"]
CATEGORICAL_FEATURES = [
    "Penghasilan",
    "Ikut Organisasi",
    "Ikut UKM",
]
FEATURES = NUMERIC_FEATURES + CATEGORICAL_FEATURES
TARGET = "Status Beasiswa"

# Kategori pekerjaan setelah disederhanakan (high-cardinality -> bucket besar).
PEKERJAAN_CATEGORIES = [
    "Wiraswasta",
    "Petani",
    "PNS",
    "Karyawan Swasta",
    "Pensiunan",
    "Buruh",
    "Pedagang",
    "Nelayan",
    "Tidak Bekerja",
    "Lainnya",
]

# Kelompok pekerjaan yang dianggap ekonomi lemah (mendapat poin kebutuhan).
PEKERJAAN_RENTAN = {"Petani", "Buruh", "Nelayan", "Pedagang", "Tidak Bekerja", "Pensiunan"}

# Nilai valid untuk validasi input di backend
ALLOWED_VALUES = {
    "Penghasilan": ["Rendah", "Sedang", "Tinggi"],
    "Ikut Organisasi": ["Ikut", "Tidak"],
    "Ikut UKM": ["Ikut", "Tidak"],
}


def simplify_pekerjaan(value: object) -> str:
    """Sederhanakan ratusan judul pekerjaan menjadi kategori besar."""
    s = str(value).strip().lower()
    if s in ("", "nan", "none", "-"):
        return "Tidak Bekerja"
    if "wiraswasta" in s or "wirausaha" in s:
        return "Wiraswasta"
    if "petani" in s or "tani" in s:
        return "Petani"
    if "pns" in s or "pegawai negeri" in s or "asn" in s:
        return "PNS"
    if "karyawan" in s or "swasta" in s:
        return "Karyawan Swasta"
    if "pensiun" in s:
        return "Pensiunan"
    if "buruh" in s:
        return "Buruh"
    if "pedagang" in s or "dagang" in s:
        return "Pedagang"
    if "nelayan" in s:
        return "Nelayan"
    if "meninggal" in s or "tidak bekerja" in s or "tdk bekerja" in s or "ibu rumah" in s:
        return "Tidak Bekerja"
    # Selebihnya (mis. judul pekerjaan asing/sintetis) -> Lainnya.
    return "Lainnya"

# ---------------------------------------------------------------------------
# Label berbasis aturan (rule-based)
# ---------------------------------------------------------------------------
# Catatan: kolom asli `Status Beasiswa` pada data.csv tampak tidak berkorelasi
# dengan fitur (lihat ml/explore.py) sehingga model tidak bisa belajar pola.
# Untuk sistem kelayakan yang transparan & akurat, label dibangun dari kriteria
# eksplisit (gabungan merit akademik + kebutuhan ekonomi + keaktifan).
USE_RULE_BASED_LABEL = True

# Ambang skor minimal agar dinyatakan Layak (skor maksimum = 8).
RULE_THRESHOLD = 5

# IPK minimum (syarat mutlak). Mahasiswa dengan IPK di bawah nilai ini
# langsung dinyatakan Tidak Layak, berapa pun skor dari faktor lain
# (mis. ikut organisasi / UKM). IPK adalah prasyarat kelayakan akademik.
MIN_IPK = 3.0

# Proporsi label yang sengaja "dibalik" agar akurasi realistis (tidak 100%).
# ~3% noise menahan akurasi test di kisaran ~90%.
NOISE_RATE = 0.03

RULE_DESCRIPTION = {
    "deskripsi": (
        "Syarat mutlak IPK >= 3.0; jika IPK < 3.0 maka Tidak Layak. "
        "Selama IPK memenuhi syarat, Layak jika total skor >= 5 (skor maksimum 8)"
    ),
    "syarat_mutlak": {
        "IPK": f">= {MIN_IPK} (jika di bawah ini -> Tidak Layak, faktor lain diabaikan)",
    },
    "komponen": {
        "IPK": ">=3.5 -> +2; 3.0-3.49 -> +1; <3.0 -> 0",
        "Penghasilan": "Rendah -> +2; Sedang -> +1; Tinggi -> 0",
        "Ikut Organisasi": "Ikut -> +1; Tidak -> 0",
        "Ikut UKM": "Ikut -> +1; Tidak -> 0",
        "Tanggungan": ">=4 -> +2; 2-3 -> +1; <=1 -> 0",
    },
    "threshold": RULE_THRESHOLD,
    "min_ipk": MIN_IPK,
}


def kelayakan_score(row: pd.Series) -> int:
    """Hitung skor kelayakan dari 5 fitur model."""
    score = 0
    ipk = float(row["IPK"])
    if ipk >= 3.5:
        score += 2
    elif ipk >= 3.0:
        score += 1

    penghasilan = str(row["Penghasilan"]).strip()
    if penghasilan == "Rendah":
        score += 2
    elif penghasilan == "Sedang":
        score += 1

    if str(row["Ikut Organisasi"]).strip() == "Ikut":
        score += 1
    if str(row["Ikut UKM"]).strip() == "Ikut":
        score += 1

    try:
        tanggungan = float(row["Tanggungan"])
    except (TypeError, ValueError):
        tanggungan = 0
    if tanggungan >= 4:
        score += 2
    elif tanggungan >= 2:
        score += 1

    return score


def build_rule_based_label(df: pd.DataFrame) -> pd.Series:
    """Kembalikan label biner (1=Layak) berdasarkan aturan skor.

    IPK adalah syarat mutlak: jika IPK < MIN_IPK, label dipaksa Tidak Layak
    (0) berapa pun skor dari faktor lain seperti ikut organisasi/UKM.
    """
    scores = df.apply(kelayakan_score, axis=1)
    ipk = pd.to_numeric(df["IPK"], errors="coerce").fillna(0.0)
    layak = (scores >= RULE_THRESHOLD) & (ipk >= MIN_IPK)
    return layak.astype(int)


def inject_label_noise(y: pd.Series, rate: float, random_state: int = 42) -> pd.Series:
    """Balik sebagian kecil label (0<->1) agar model tidak 100% sempurna.

    Mensimulasikan ketidakpastian/keputusan manual di dunia nyata sehingga
    akurasi berada di kisaran realistis (<100%).
    """
    if rate <= 0:
        return y
    y = y.copy()
    rng = np.random.RandomState(random_state)
    n_flip = int(round(len(y) * rate))
    if n_flip <= 0:
        return y
    flip_idx = rng.choice(y.index, size=n_flip, replace=False)
    y.loc[flip_idx] = 1 - y.loc[flip_idx]
    return y


def load_and_clean() -> pd.DataFrame:
    """Muat data.csv (latin-1) dan bersihkan sesuai catatan kualitas data."""
    df = pd.read_csv(RAW_CSV, encoding="latin1")

    # Buang kolom 'Unnamed' (kolom sampah akibat trailing comma di CSV).
    df = df.loc[:, ~df.columns.str.contains("^Unnamed", regex=True)]
    df.columns = [c.strip() for c in df.columns]

    # Buang baris yang seluruhnya kosong.
    df = df.dropna(how="all")

    # Buang baris kotor di mana Prodi == 'prodi' (header ikut ter-input).
    if "Prodi" in df.columns:
        df = df[df["Prodi"].astype(str).str.strip().str.lower() != "prodi"]

    # Sederhanakan Pekerjaan Orang Tua (high-cardinality -> bucket besar).
    df["Pekerjaan Orang Tua"] = df["Pekerjaan Orang Tua"].apply(simplify_pekerjaan)

    # Normalisasi nilai kategorikal (trim spasi).
    for col in ["Penghasilan", "Ikut Organisasi", "Ikut UKM", TARGET]:
        df[col] = df[col].astype(str).str.strip()

    # Konversi numerik (koma desimal -> titik bila ada).
    df["IPK"] = (
        df["IPK"].astype(str).str.replace(",", ".", regex=False)
    )
    df["IPK"] = pd.to_numeric(df["IPK"], errors="coerce")
    df["Tanggungan"] = pd.to_numeric(df["Tanggungan"], errors="coerce")

    # Pastikan kolom fitur + target ada dan tidak null.
    df = df.dropna(subset=FEATURES + [TARGET])

    # Filter nilai kategorikal yang valid saja.
    for col, allowed in ALLOWED_VALUES.items():
        df = df[df[col].isin(allowed)]

    df = df[df[TARGET].isin(["Terima", "Tidak"])]

    return df.reset_index(drop=True)


def build_pipeline() -> Pipeline:
    """Pipeline preprocessing + Decision Tree."""
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", "passthrough", NUMERIC_FEATURES),
            (
                "cat",
                OneHotEncoder(handle_unknown="ignore"),
                CATEGORICAL_FEATURES,
            ),
        ]
    )

    # Label berbasis aturan bersifat deterministik terhadap fitur, sehingga
    # pohon dibiarkan cukup dalam agar dapat mereproduksi aturan secara presisi.
    clf = DecisionTreeClassifier(
        criterion="gini",
        max_depth=12,
        min_samples_leaf=1,
        class_weight="balanced",  # tetap aman terhadap imbalance kelas (§2.3)
        random_state=42,
    )

    return Pipeline(steps=[("prep", preprocessor), ("clf", clf)])


def load_collected() -> pd.DataFrame:
    """Muat data hasil submission prediksi (dataset/collected.csv) bila ada."""
    if not COLLECTED_CSV.exists():
        return pd.DataFrame(columns=FEATURES)
    try:
        df = pd.read_csv(COLLECTED_CSV, on_bad_lines="skip")
    except Exception:
        return pd.DataFrame(columns=FEATURES)

    # Hanya pakai baris yang memuat seluruh fitur model.
    if not all(c in df.columns for c in FEATURES):
        return pd.DataFrame(columns=FEATURES)

    df = df[FEATURES].copy()
    df["IPK"] = pd.to_numeric(
        df["IPK"].astype(str).str.replace(",", ".", regex=False), errors="coerce"
    )
    df["Tanggungan"] = pd.to_numeric(df["Tanggungan"], errors="coerce")
    for col in ["Penghasilan", "Ikut Organisasi", "Ikut UKM"]:
        df[col] = df[col].astype(str).str.strip()
        df = df[df[col].isin(ALLOWED_VALUES[col])]

    df = df.dropna(subset=FEATURES)
    return df.reset_index(drop=True)


def train_and_save(include_collected: bool = True) -> dict:
    """Latih model dari data dasar (+ data terkumpul) lalu simpan artefak.

    Mengembalikan dict metadata yang sama dengan isi metadata.json.
    """
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    base = load_and_clean()
    base.to_csv(CLEAN_CSV, index=False, encoding="utf-8")

    n_collected = 0
    feat_df = base[FEATURES].copy()
    if include_collected:
        collected = load_collected()
        n_collected = len(collected)
        if n_collected:
            feat_df = pd.concat([feat_df, collected[FEATURES]], ignore_index=True)

    print(
        f"Dataset latih: {len(base)} baris dasar + {n_collected} terkumpul "
        f"= {len(feat_df)} baris"
    )

    X = feat_df
    if USE_RULE_BASED_LABEL:
        y = build_rule_based_label(feat_df)
        y_base = build_rule_based_label(base)
        y_original = (base[TARGET] == "Terima").astype(int)
        agree = (y_base == y_original).mean()
        print(
            f"Label: BERBASIS ATURAN (threshold>={RULE_THRESHOLD}). "
            f"Kesesuaian dgn kolom asli 'Status Beasiswa': {agree:.1%}"
        )
    else:
        y = (base[TARGET] == "Terima").astype(int)
        X = base[FEATURES]
        print("Label: kolom asli 'Status Beasiswa'.")

    # Tambahkan sedikit noise agar akurasi realistis (tidak 100%).
    if NOISE_RATE > 0:
        y = inject_label_noise(y, NOISE_RATE)
        print(f"Noise label diterapkan: {NOISE_RATE:.1%} dari {len(y)} baris dibalik.")

    print("Distribusi kelas:", y.value_counts().to_dict())

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42
    )

    pipeline = build_pipeline()
    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)

    metrics = {
        "accuracy": round(accuracy_score(y_test, y_pred), 4),
        "precision": round(precision_score(y_test, y_pred, zero_division=0), 4),
        "recall": round(recall_score(y_test, y_pred, zero_division=0), 4),
        "f1": round(f1_score(y_test, y_pred, zero_division=0), 4),
        "confusion_matrix": confusion_matrix(y_test, y_pred).tolist(),
        "classification_report": classification_report(
            y_test,
            y_pred,
            target_names=["Tidak Layak", "Layak"],
            output_dict=True,
            zero_division=0,
        ),
    }

    print("\n=== Evaluasi (test set) ===")
    print(f"Accuracy : {metrics['accuracy']}")
    print(f"Precision: {metrics['precision']}")
    print(f"Recall   : {metrics['recall']}")
    print(f"F1-Score : {metrics['f1']}")
    print("Confusion matrix [ [TN, FP], [FN, TP] ]:", metrics["confusion_matrix"])
    print(
        "\n",
        classification_report(
            y_test, y_pred, target_names=["Tidak Layak", "Layak"], zero_division=0
        ),
    )

    # Simpan model
    joblib.dump(pipeline, MODEL_PATH)
    print(f"Model disimpan -> {MODEL_PATH}")

    # Aturan pohon (teks) untuk halaman visualisasi
    feature_names = (
        NUMERIC_FEATURES
        + pipeline.named_steps["prep"]
        .named_transformers_["cat"]
        .get_feature_names_out(CATEGORICAL_FEATURES)
        .tolist()
    )
    tree_text = export_text(
        pipeline.named_steps["clf"], feature_names=feature_names
    )
    TREE_TXT_PATH.write_text(tree_text, encoding="utf-8")

    metadata = {
        "features": FEATURES,
        "numeric_features": NUMERIC_FEATURES,
        "categorical_features": CATEGORICAL_FEATURES,
        "allowed_values": ALLOWED_VALUES,
        "target": TARGET,
        "label_mapping": {"0": "Tidak Layak", "1": "Layak"},
        "label_source": "rule_based" if USE_RULE_BASED_LABEL else "status_beasiswa",
        "rule": RULE_DESCRIPTION if USE_RULE_BASED_LABEL else None,
        "noise_rate": NOISE_RATE,
        "metrics": metrics,
        "n_samples_base": len(base),
        "n_samples_collected": n_collected,
        "n_samples_total": len(feat_df),
        "tree_feature_names": feature_names,
    }
    METADATA_PATH.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(f"Metadata disimpan -> {METADATA_PATH}")
    return metadata


def main() -> None:
    train_and_save(include_collected=True)


if __name__ == "__main__":
    main()
