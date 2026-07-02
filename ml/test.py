"""
Evaluasi model — Sistem Prediksi Kelayakan Beasiswa (Decision Tree).

Script ini TIDAK melatih ulang logic dari nol — semua fungsi preprocessing,
label rule-based, dan pipeline diimpor langsung dari train.py supaya hasil
evaluasi konsisten 1:1 dengan model yang dipakai di produksi.

Menjawab pertanyaan "seberapa akurat & seberapa stabil model ini?" dengan 3 lensa:
  1. K-Fold Cross Validation (5-fold & 10-fold)      -> stabilitas akurasi
  2. Perbandingan rasio split 70:30 / 80:20 / 90:10   -> sensitivitas terhadap ukuran data uji
  3. Evaluasi holdout test set (sama seperti train.py) -> confusion matrix & classification report detail

Jalankan dari root proyek (folder yang sama dengan train.py):
    python ml/evaluate.py
"""
from __future__ import annotations

import json

import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split

from train import (
    FEATURES,
    MODEL_DIR,
    NOISE_RATE,
    TARGET,
    build_pipeline,
    build_rule_based_label,
    inject_label_noise,
    load_and_clean,
    load_collected,
)

EVAL_PATH = MODEL_DIR / "evaluation.json"


def prepare_xy(include_collected: bool = True) -> tuple[pd.DataFrame, pd.Series]:
    """Siapkan X, y persis seperti alur di train_and_save()."""
    base = load_and_clean()
    feat_df = base[FEATURES].copy()

    if include_collected:
        collected = load_collected()
        if len(collected):
            feat_df = pd.concat([feat_df, collected[FEATURES]], ignore_index=True)

    y = build_rule_based_label(feat_df)
    if NOISE_RATE > 0:
        y = inject_label_noise(y, NOISE_RATE)

    return feat_df, y


def run_kfold(X: pd.DataFrame, y: pd.Series, k: int) -> dict:
    """Stratified K-Fold CV, kembalikan akurasi tiap fold + ringkasan."""
    pipeline = build_pipeline()
    skf = StratifiedKFold(n_splits=k, shuffle=True, random_state=42)
    scores = cross_val_score(pipeline, X, y, cv=skf, scoring="accuracy")
    return {
        "k": k,
        "scores_per_fold": [round(float(s), 4) for s in scores],
        "mean_accuracy": round(scores.mean(), 4),
        "std_accuracy": round(scores.std(), 4),
    }


def run_split_ratio_comparison(X: pd.DataFrame, y: pd.Series) -> list[dict]:
    """Bandingkan akurasi untuk beberapa rasio train:test yang umum dipakai di paper."""
    ratios = [0.3, 0.2, 0.1]  # proporsi test set -> 70:30, 80:20, 90:10
    results = []
    for test_size in ratios:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, stratify=y, random_state=42
        )
        pipeline = build_pipeline()
        pipeline.fit(X_train, y_train)
        y_pred = pipeline.predict(X_test)

        train_pct = int(round((1 - test_size) * 100))
        test_pct = int(round(test_size * 100))
        results.append({
            "rasio": f"{train_pct}:{test_pct}",
            "n_train": len(X_train),
            "n_test": len(X_test),
            "accuracy": round(accuracy_score(y_test, y_pred), 4),
            "precision": round(precision_score(y_test, y_pred, zero_division=0), 4),
            "recall": round(recall_score(y_test, y_pred, zero_division=0), 4),
            "f1": round(f1_score(y_test, y_pred, zero_division=0), 4),
        })
    return results


def run_holdout_detail(X: pd.DataFrame, y: pd.Series) -> dict:
    """Evaluasi detail pada split 80:20 (sama seperti train.py) -> confusion matrix & report lengkap."""
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42
    )
    pipeline = build_pipeline()
    pipeline.fit(X_train, y_train)
    y_pred = pipeline.predict(X_test)

    cm = confusion_matrix(y_test, y_pred)
    report = classification_report(
        y_test, y_pred, target_names=["Tidak Layak", "Layak"],
        output_dict=True, zero_division=0,
    )
    report_text = classification_report(
        y_test, y_pred, target_names=["Tidak Layak", "Layak"], zero_division=0
    )

    return {
        "n_train": len(X_train),
        "n_test": len(X_test),
        "accuracy": round(accuracy_score(y_test, y_pred), 4),
        "confusion_matrix": cm.tolist(),
        "confusion_matrix_label": "[[TN, FP], [FN, TP]] -> baris=aktual, kolom=prediksi",
        "classification_report": report,
        "classification_report_text": report_text,
    }


def main() -> None:
    X, y = prepare_xy(include_collected=True)
    print(f"Total data untuk evaluasi: {len(X)} baris")
    print("Distribusi kelas:", y.value_counts().to_dict())

    print("\n=== 1. K-Fold Cross Validation ===")
    kfold_results = []
    for k in (5, 10):
        res = run_kfold(X, y, k)
        kfold_results.append(res)
        print(f"{k}-Fold: mean acc = {res['mean_accuracy']:.4f} "
              f"+/- {res['std_accuracy']:.4f}  | per-fold: {res['scores_per_fold']}")

    print("\n=== 2. Perbandingan Rasio Split Train:Test ===")
    split_results = run_split_ratio_comparison(X, y)
    for r in split_results:
        print(f"{r['rasio']:8s} (train={r['n_train']}, test={r['n_test']}) -> "
              f"acc={r['accuracy']:.4f}  prec={r['precision']:.4f}  "
              f"rec={r['recall']:.4f}  f1={r['f1']:.4f}")

    print("\n=== 3. Evaluasi Detail Holdout 80:20 ===")
    holdout = run_holdout_detail(X, y)
    print(f"Accuracy: {holdout['accuracy']:.4f}")
    print("Confusion matrix [[TN, FP], [FN, TP]]:", holdout["confusion_matrix"])
    print()
    print(holdout["classification_report_text"])

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    output = {
        "n_total_samples": len(X),
        "kfold_cross_validation": kfold_results,
        "split_ratio_comparison": split_results,
        "holdout_80_20_detail": holdout,
    }
    EVAL_PATH.write_text(json.dumps(output, indent=2), encoding="utf-8")
    print(f"\nHasil evaluasi lengkap disimpan -> {EVAL_PATH}")


if __name__ == "__main__":
    main()