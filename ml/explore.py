"""Eksplorasi cepat: seberapa tinggi akurasi yang realistis dari data ini?"""
from pathlib import Path
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import cross_val_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.tree import DecisionTreeClassifier

ROOT = Path(__file__).resolve().parents[1]
df = pd.read_csv(ROOT / "dataset" / "data.csv", encoding="latin1")
df = df.loc[:, ~df.columns.str.contains("^Unnamed")]
df.columns = [c.strip() for c in df.columns]
df = df.dropna(how="all")
df = df[df["Prodi"].astype(str).str.strip().str.lower() != "prodi"]

TARGET = "Status Beasiswa"
df = df.dropna(subset=[TARGET])
df["IPK"] = df["IPK"].astype(str).str.replace(",", ".").astype(float)
y = (df[TARGET].str.strip() == "Terima").astype(int)

print("Baseline (selalu tebak mayoritas):", round((y == 0).mean(), 3))

# 1) Hanya 4 fitur inti
core_num = ["IPK"]
core_cat = ["Penghasilan", "Ikut Organisasi", "Ikut UKM"]

# 2) Fitur diperluas (tambah SKS, Tanggungan, Jenis Kelamin, Jarak, Tahun Lulus, Prodi)
ext_num = ["IPK", "SKS", "Tanggungan", "Tahun Lulus"]
ext_cat = [
    "Penghasilan", "Ikut Organisasi", "Ikut UKM",
    "Jenis Kelamin", "Jarak Tempat Tinggal kekampus (Km)", "Prodi",
]


def evaluate(name, num, cat, model):
    cols = num + cat
    X = df[cols].copy()
    for c in num:
        X[c] = pd.to_numeric(X[c], errors="coerce")
    X = X.fillna({c: X[c].median() for c in num})
    for c in cat:
        X[c] = X[c].astype(str)
    pre = ColumnTransformer([
        ("num", "passthrough", num),
        ("cat", OneHotEncoder(handle_unknown="ignore"), cat),
    ])
    pipe = Pipeline([("pre", pre), ("clf", model)])
    scores = cross_val_score(pipe, X, y, cv=5, scoring="accuracy")
    print(f"{name:45s} acc = {scores.mean():.3f} +/- {scores.std():.3f}")


print("\n--- Decision Tree ---")
evaluate("DT, 4 fitur inti", core_num, core_cat,
         DecisionTreeClassifier(max_depth=5, min_samples_leaf=20, class_weight="balanced", random_state=42))
evaluate("DT, fitur diperluas", ext_num, ext_cat,
         DecisionTreeClassifier(max_depth=8, min_samples_leaf=10, class_weight="balanced", random_state=42))
evaluate("DT, diperluas (tanpa balanced, deep)", ext_num, ext_cat,
         DecisionTreeClassifier(max_depth=None, min_samples_leaf=2, random_state=42))

print("\n--- Random Forest (pembanding batas atas) ---")
evaluate("RF, 4 fitur inti", core_num, core_cat,
         RandomForestClassifier(n_estimators=300, class_weight="balanced", random_state=42))
evaluate("RF, fitur diperluas", ext_num, ext_cat,
         RandomForestClassifier(n_estimators=300, class_weight="balanced", random_state=42))
