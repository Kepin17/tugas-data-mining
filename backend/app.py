"""
Backend API — Sistem Prediksi Kelayakan Beasiswa.

FastAPI yang memuat model Decision Tree (model/model.joblib) dan menyediakan:
- GET  /                : health check
- GET  /metadata        : info fitur, nilai valid, metrik evaluasi
- GET  /tree            : aturan pohon keputusan (teks)
- GET  /tree-structure  : struktur pohon (JSON) untuk diagram interaktif
- POST /predict         : prediksi + jalur keputusan yang dilewati input
- POST /retrain         : latih ulang model dari data dasar + data terkumpul

Jalankan dari root proyek (port default 8005):
    python backend/app.py
atau:
    uvicorn backend.app:app --reload --port 8005
"""
from __future__ import annotations

import csv
import json
import sys
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ml import train as trainer  # noqa: E402

MODEL_PATH = ROOT / "model" / "model.joblib"
METADATA_PATH = ROOT / "model" / "metadata.json"
TREE_TXT_PATH = ROOT / "model" / "tree_rules.txt"
COLLECTED_CSV = ROOT / "dataset" / "collected.csv"

CATEGORICAL_FEATURES = trainer.CATEGORICAL_FEATURES

app = FastAPI(
    title="API Prediksi Kelayakan Beasiswa",
    description="Serving model Decision Tree untuk memprediksi kelayakan penerima beasiswa.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Artefak model (dimuat saat startup, dapat dimuat ulang setelah retrain)
# ---------------------------------------------------------------------------
_lock = threading.Lock()
_model = None
_metadata: dict = {}
_tree_text = ""
_tree_structure: dict = {}


def _readable_feature(raw_name: str) -> tuple[str, str | None]:
    """Pisahkan nama fitur one-hot 'Penghasilan_Rendah' -> ('Penghasilan', 'Rendah')."""
    for cat in CATEGORICAL_FEATURES:
        prefix = cat + "_"
        if raw_name.startswith(prefix):
            return cat, raw_name[len(prefix):]
    return raw_name, None


def _build_tree_structure(model, feature_names: list[str]) -> dict:
    """Ubah DecisionTree (sklearn) menjadi JSON bercabang untuk frontend.

    Setiap node: id, kondisi, jumlah sampel, distribusi kelas, kelas prediksi,
    serta label cabang anak (kiri/kanan) yang mudah dibaca.
    """
    clf = model.named_steps["clf"]
    t = clf.tree_

    def node_dict(idx: int, branch_label: str | None) -> dict:
        n_samples = int(t.n_node_samples[idx])
        values = t.value[idx][0]
        total = float(values.sum()) or 1.0
        tidak, layak = float(values[0]), float(values[1])
        kelas = 1 if layak >= tidak else 0
        is_leaf = t.children_left[idx] == t.children_right[idx]

        node = {
            "id": int(idx),
            "is_leaf": bool(is_leaf),
            "samples": n_samples,
            "tidak_layak": int(round(tidak)),
            "layak": int(round(layak)),
            "kelas": kelas,
            "kelas_label": "Layak" if kelas == 1 else "Tidak Layak",
            "confidence": round((max(tidak, layak) / total), 3),
            "branch_label": branch_label,
        }

        if is_leaf:
            node["name"] = "Layak" if kelas == 1 else "Tidak Layak"
            node["children"] = []
            return node

        raw = feature_names[t.feature[idx]]
        thr = float(t.threshold[idx])
        feat, category = _readable_feature(raw)
        if category is None:
            # Fitur numerik (mis. IPK)
            node["name"] = f"{feat} \u2264 {thr:.2f} ?"
            node["feature"] = feat
            left_label, right_label = "Ya", "Tidak"  # <= thr : Ya
        else:
            # Fitur kategorikal one-hot: thr ~ 0.5
            node["name"] = f"{feat} = {category} ?"
            node["feature"] = feat
            left_label, right_label = "Tidak", "Ya"  # <=0.5 berarti BUKAN kategori

        node["children"] = [
            node_dict(int(t.children_left[idx]), left_label),
            node_dict(int(t.children_right[idx]), right_label),
        ]
        return node

    return node_dict(0, None)


def _decision_path(model, row: pd.DataFrame) -> list[int]:
    """Daftar id node yang dilewati input pada pohon."""
    clf = model.named_steps["clf"]
    transformed = model.named_steps["prep"].transform(row)
    indicator = clf.decision_path(transformed)
    return indicator.indices.tolist()


def _load_artifacts() -> None:
    """Muat ulang model + metadata + struktur pohon ke memori."""
    global _model, _metadata, _tree_text, _tree_structure
    if not MODEL_PATH.exists():
        raise RuntimeError(
            f"Model tidak ditemukan di {MODEL_PATH}. Jalankan dulu: python ml/train.py"
        )
    with _lock:
        _model = joblib.load(MODEL_PATH)
        _metadata = json.loads(METADATA_PATH.read_text(encoding="utf-8"))
        _tree_text = (
            TREE_TXT_PATH.read_text(encoding="utf-8") if TREE_TXT_PATH.exists() else ""
        )
        _tree_structure = _build_tree_structure(
            _model, _metadata.get("tree_feature_names", [])
        )


_load_artifacts()


class PredictRequest(BaseModel):
    # --- 5 fitur yang dipakai model ---
    ipk: float = Field(..., ge=0.0, le=4.0, description="IPK mahasiswa (0.0 - 4.0)")
    penghasilan: Literal["Rendah", "Sedang", "Tinggi"]
    ikut_organisasi: Literal["Ikut", "Tidak"]
    ikut_ukm: Literal["Ikut", "Tidak"]
    tanggungan: int = Field(..., ge=0, le=20, description="Jumlah tanggungan keluarga")

    # --- field identitas/administratif (disimpan, TIDAK dipakai model) ---
    pekerjaan_orang_tua: str | None = None
    nama_lengkap: str | None = None
    prodi: str | None = None
    jenis_kelamin: str | None = None
    jarak_tempat_tinggal: str | None = None
    asal_sekolah: str | None = None
    tahun_lulus: int | None = None
    sks: int | None = None


class PredictResponse(BaseModel):
    label: int
    status: str
    probabilitas_layak: float
    probabilitas_tidak_layak: float
    decision_path: list[int]
    leaf_id: int


# Kolom collected.csv: identitas + 6 fitur model (Pekerjaan sudah disederhanakan).
COLLECTED_COLUMNS = [
    "timestamp",
    "Nama Lengkap",
    "Prodi",
    "Jenis Kelamin",
    "Jarak Tempat Tinggal kekampus (Km)",
    "Asal Sekolah",
    "Tahun Lulus",
    "SKS",
    "IPK",
    "Penghasilan",
    "Ikut Organisasi",
    "Ikut UKM",
    "Tanggungan",
    "Pekerjaan Orang Tua",
]


def _record_submission(req: "PredictRequest", pekerjaan_kategori: str) -> None:
    """Simpan input (identitas + fitur) ke dataset/collected.csv untuk retrain."""
    COLLECTED_CSV.parent.mkdir(parents=True, exist_ok=True)
    is_new = not COLLECTED_CSV.exists()
    with _lock, COLLECTED_CSV.open("a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if is_new:
            writer.writerow(COLLECTED_COLUMNS)
        writer.writerow(
            [
                datetime.now(timezone.utc).isoformat(),
                req.nama_lengkap or "",
                req.prodi or "",
                req.jenis_kelamin or "",
                req.jarak_tempat_tinggal or "",
                req.asal_sekolah or "",
                req.tahun_lulus if req.tahun_lulus is not None else "",
                req.sks if req.sks is not None else "",
                req.ipk,
                req.penghasilan,
                req.ikut_organisasi,
                req.ikut_ukm,
                req.tanggungan,
                pekerjaan_kategori,
            ]
        )


@app.get("/")
def root() -> dict:
    return {"status": "ok", "message": "API Prediksi Kelayakan Beasiswa aktif."}


@app.get("/metadata")
def metadata() -> dict:
    return _metadata


@app.get("/tree")
def tree() -> dict:
    return {"feature_names": _metadata.get("tree_feature_names", []), "rules": _tree_text}


@app.get("/tree-structure")
def tree_structure() -> dict:
    """Struktur pohon (JSON) untuk diagram interaktif di frontend."""
    return {
        "tree": _tree_structure,
        "n_samples_total": _metadata.get("n_samples_total"),
        "n_samples_collected": _metadata.get("n_samples_collected", 0),
        "accuracy": _metadata.get("metrics", {}).get("accuracy"),
    }


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest) -> PredictResponse:
    # Susun input sesuai 5 fitur & nama kolom yang dipakai saat training.
    # Pekerjaan Orang Tua TIDAK dipakai model (hanya disimpan sebagai data).
    row = pd.DataFrame(
        [
            {
                "IPK": req.ipk,
                "Tanggungan": req.tanggungan,
                "Penghasilan": req.penghasilan,
                "Ikut Organisasi": req.ikut_organisasi,
                "Ikut UKM": req.ikut_ukm,
            }
        ]
    )

    try:
        proba = _model.predict_proba(row)[0]
        label = int(_model.predict(row)[0])
        path = _decision_path(_model, row)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Gagal memprediksi: {exc}") from exc

    # Simpan pekerjaan (disederhanakan) sebagai data administratif.
    pekerjaan_kategori = trainer.simplify_pekerjaan(req.pekerjaan_orang_tua)
    _record_submission(req, pekerjaan_kategori)

    return PredictResponse(
        label=label,
        status="Layak" if label == 1 else "Tidak Layak",
        probabilitas_layak=round(float(proba[1]), 4),
        probabilitas_tidak_layak=round(float(proba[0]), 4),
        decision_path=path,
        leaf_id=path[-1] if path else 0,
    )


# Kolom yang ditampilkan pada halaman Dataset (urut & ringkas).
DATASET_COLUMNS = [
    "Nama Lengkap",
    "Prodi",
    "Jenis Kelamin",
    "Asal Sekolah",
    "Tahun Lulus",
    "SKS",
    "IPK",
    "Penghasilan",
    "Tanggungan",
    "Pekerjaan Orang Tua",
    "Ikut Organisasi",
    "Ikut UKM",
    "Status Beasiswa",
]


@app.get("/dataset")
def dataset() -> dict:
    """Kembalikan dataset (hasil pembersihan) untuk ditampilkan sebagai tabel."""
    try:
        df = trainer.load_and_clean()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Gagal memuat dataset: {exc}") from exc

    cols = [c for c in DATASET_COLUMNS if c in df.columns]
    rows = json.loads(df[cols].to_json(orient="records"))
    return {"columns": cols, "rows": rows, "total": len(rows)}


@app.post("/retrain")
def retrain() -> dict:
    """Latih ulang model dari data dasar + data terkumpul, lalu muat ulang."""
    try:
        meta = trainer.train_and_save(include_collected=True)
        _load_artifacts()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Gagal retrain: {exc}") from exc

    return {
        "message": "Model berhasil dilatih ulang.",
        "n_samples_base": meta.get("n_samples_base"),
        "n_samples_collected": meta.get("n_samples_collected"),
        "n_samples_total": meta.get("n_samples_total"),
        "accuracy": meta.get("metrics", {}).get("accuracy"),
    }


# Port default API = 8005. Jalankan dengan: python backend/app.py
DEFAULT_PORT = 8005

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.app:app", host="127.0.0.1", port=DEFAULT_PORT, reload=True)
