import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Brain, ClipboardCheck, GitBranch, TrendingUp } from "lucide-react";
import { getMetadata } from "../api.js";

function MetricCard({ label, value }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-indigo-600">{(value * 100).toFixed(1)}%</p>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, desc }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
      <span className="grid place-items-center w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600">
        <Icon size={22} />
      </span>
      <h3 className="mt-4 font-semibold text-lg">{title}</h3>
      <p className="mt-1 text-sm text-slate-500 leading-relaxed">{desc}</p>
    </div>
  );
}

export default function Home() {
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getMetadata()
      .then(setMeta)
      .catch((e) => setError(e.message));
  }, []);

  const m = meta?.metrics;

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-b from-indigo-50 to-transparent">
        <div className="max-w-5xl mx-auto px-4 py-20 text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold">
            <Brain size={14} /> Machine Learning · Decision Tree
          </span>
          <h1 className="mt-5 text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
            Prediksi Kelayakan
            <span className="text-indigo-600"> Penerima Beasiswa</span>
          </h1>
          <p className="mt-5 max-w-2xl mx-auto text-slate-600 text-lg">
            Masukkan data akademik dan sosial-ekonomi mahasiswa, lalu sistem akan memprediksi apakah <strong>Layak</strong> atau <strong>Tidak Layak</strong> menerima beasiswa berdasarkan model Decision Tree.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link to="/prediksi" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors">
              Mulai Prediksi <ArrowRight size={18} />
            </Link>
            <Link to="/pohon" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white border border-slate-300 font-semibold hover:bg-slate-50 transition-colors">
              Lihat Pohon Keputusan
            </Link>
          </div>
        </div>
      </section>

      {/* Metrics */}
      <section className="max-w-5xl mx-auto px-4 -mt-6 pb-4">
        {error && <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 p-4 text-sm">Tidak dapat memuat metrik model: {error}. Pastikan backend berjalan di port 8000.</div>}
        {m && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Accuracy" value={m.accuracy} />
            <MetricCard label="Precision (Layak)" value={m.precision} />
            <MetricCard label="Recall (Layak)" value={m.recall} />
            <MetricCard label="F1-Score (Layak)" value={m.f1} />
          </div>
        )}
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-center">Bagaimana Cara Kerjanya?</h2>
        <div className="mt-8 grid md:grid-cols-3 gap-5">
          <FeatureCard icon={ClipboardCheck} title="1. Isi Data Mahasiswa" desc="Enam fitur: IPK, penghasilan, organisasi, UKM, jumlah tanggungan, dan pekerjaan orang tua." />
          <FeatureCard icon={TrendingUp} title="2. Model Memproses" desc="Model Decision Tree (class_weight balanced) memproses input sesuai pipeline training." />
          <FeatureCard icon={GitBranch} title="3. Hasil & Transparansi" desc="Dapatkan label Layak/Tidak Layak beserta probabilitas dan aturan pohon keputusan." />
        </div>
      </section>
    </div>
  );
}
