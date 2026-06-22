// Helper untuk memanggil backend FastAPI.
// Base URL API dipusatkan di satu env: `frontend/.env` -> VITE_API_BASE.
// - Dev: request /api/* di-proxy ke http://127.0.0.1:8005 (lihat vite.config.js).
// - Prod: nginx mem-proxy /api/* ke backend 8005 (lihat deploy/nginx/datamining.conf).
const BASE = import.meta.env.VITE_API_BASE || "/api";

export async function predict(payload) {
  const res = await fetch(`${BASE}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Gagal memprediksi.");
  }
  return res.json();
}

export async function getMetadata() {
  const res = await fetch(`${BASE}/metadata`);
  if (!res.ok) throw new Error("Gagal memuat metadata.");
  return res.json();
}

export async function getTree() {
  const res = await fetch(`${BASE}/tree`);
  if (!res.ok) throw new Error("Gagal memuat pohon keputusan.");
  return res.json();
}

export async function getTreeStructure() {
  const res = await fetch(`${BASE}/tree-structure`);
  if (!res.ok) throw new Error("Gagal memuat struktur pohon.");
  return res.json();
}

export async function getDataset() {
  const res = await fetch(`${BASE}/dataset`);
  if (!res.ok) throw new Error("Gagal memuat dataset.");
  return res.json();
}

export async function retrain() {
  const res = await fetch(`${BASE}/retrain`, { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Gagal melatih ulang model.");
  }
  return res.json();
}
