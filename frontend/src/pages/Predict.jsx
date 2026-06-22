import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2, Sparkles, GitBranch } from "lucide-react";
import { predict } from "../api.js";
import { usePrediction } from "../context/PredictionContext.jsx";

const PENGHASILAN = ["Rendah", "Sedang", "Tinggi"];
const YA_TIDAK = ["Ikut", "Tidak"];
const JENIS_KELAMIN = ["L", "P"];
const JARAK = ["Dekat", "Jauh"];
const PEKERJAAN = ["Wiraswasta", "Petani", "PNS", "Karyawan Swasta", "Pensiunan", "Buruh", "Pedagang", "Nelayan", "Tidak Bekerja", "Lainnya"];

function SegmentedField({ label, options, value, onChange, cols = 3 }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>
      <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`py-2.5 rounded-xl text-sm font-medium border transition-colors ${value === opt ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"}`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, type = "text", placeholder, ...rest }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" {...rest} />
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

function ResultCard({ result }) {
  const layak = result.label === 1;
  const pct = (result.probabilitas_layak * 100).toFixed(1);
  return (
    <div className={`rounded-2xl border p-6 ${layak ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"}`}>
      <div className="flex items-center gap-3">
        {layak ? <CheckCircle2 className="text-emerald-600" size={36} /> : <XCircle className="text-rose-600" size={36} />}
        <div>
          <p className="text-sm text-slate-500">Hasil Prediksi</p>
          <p className={`text-2xl font-bold ${layak ? "text-emerald-700" : "text-rose-700"}`}>{result.status}</p>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>Probabilitas Layak</span>
          <span className="font-semibold">{pct}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
          <div className={`h-full ${layak ? "bg-emerald-500" : "bg-rose-500"}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

const INITIAL_FORM = {
  // identitas / administratif
  nama_lengkap: "",
  prodi: "",
  jenis_kelamin: "L",
  jarak_tempat_tinggal: "Dekat",
  asal_sekolah: "",
  tahun_lulus: 2020,
  sks: 21,
  // fitur model
  ipk: 3.0,
  penghasilan: "Sedang",
  ikut_organisasi: "Ikut",
  ikut_ukm: "Ikut",
  tanggungan: 2,
  pekerjaan_orang_tua: "Wiraswasta",
};

export default function Predict() {
  const { setLastPrediction } = usePrediction();
  const [form, setForm] = useState(INITIAL_FORM);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const update = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const input = {
        ...form,
        ipk: Number(form.ipk),
        tanggungan: Number(form.tanggungan),
        tahun_lulus: form.tahun_lulus ? Number(form.tahun_lulus) : null,
        sks: form.sks ? Number(form.sks) : null,
      };
      const data = await predict(input);
      setResult(data);
      // Simpan jalur keputusan agar pohon dapat menyorotinya secara real-time.
      setLastPrediction({ input, result: data, at: Date.now() });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold">Form Prediksi Beasiswa</h1>
      <p className="mt-2 text-slate-600">Isi data mahasiswa secara lengkap. Hanya 5 data (IPK, Penghasilan, Organisasi, UKM, Tanggungan) yang dipakai model.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-6">
        {/* Bagian 1: Data Diri & Administratif */}
        <section className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-lg">Data Diri & Administratif</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">disimpan, tidak dipakai model</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <TextField label="Nama Lengkap" value={form.nama_lengkap} onChange={(v) => update("nama_lengkap", v)} placeholder="cth: Galan Prasetio" />
            <TextField label="Prodi" value={form.prodi} onChange={(v) => update("prodi", v)} placeholder="cth: S1 Teknik Mesin" />
            <SelectField label="Jenis Kelamin" value={form.jenis_kelamin} onChange={(v) => update("jenis_kelamin", v)} options={JENIS_KELAMIN} />
            <SelectField label="Jarak ke Kampus" value={form.jarak_tempat_tinggal} onChange={(v) => update("jarak_tempat_tinggal", v)} options={JARAK} />
            <TextField label="Asal Sekolah" value={form.asal_sekolah} onChange={(v) => update("asal_sekolah", v)} placeholder="cth: SMAN 1 ..." />
            <TextField label="Tahun Lulus" type="number" value={form.tahun_lulus} onChange={(v) => update("tahun_lulus", v)} min="2000" max="2030" />
            <TextField label="SKS" type="number" value={form.sks} onChange={(v) => update("sks", v)} min="0" max="200" />
            <SelectField label="Pekerjaan Orang Tua" value={form.pekerjaan_orang_tua} onChange={(v) => update("pekerjaan_orang_tua", v)} options={PEKERJAAN} />
          </div>
        </section>

        {/* Bagian 2: Data untuk Penilaian Model */}
        <section className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-lg">Data Penilaian (Fitur Model)</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600">5 fitur</span>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              IPK <span className="text-slate-400">(0.00 – 4.00)</span>
            </label>
            <div className="flex items-center gap-4">
              <input type="range" min="0" max="4" step="0.01" value={form.ipk} onChange={(e) => update("ipk", e.target.value)} className="flex-1 accent-indigo-600" />
              <input
                type="number"
                min="0"
                max="4"
                step="0.01"
                value={form.ipk}
                onChange={(e) => update("ipk", e.target.value)}
                className="w-24 rounded-xl border border-slate-300 px-3 py-2 text-center font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <SegmentedField label="Penghasilan Orang Tua" options={PENGHASILAN} value={form.penghasilan} onChange={(v) => update("penghasilan", v)} />
          <div className="grid sm:grid-cols-2 gap-4">
            <SegmentedField label="Ikut Organisasi" options={YA_TIDAK} value={form.ikut_organisasi} onChange={(v) => update("ikut_organisasi", v)} cols={2} />
            <SegmentedField label="Ikut UKM" options={YA_TIDAK} value={form.ikut_ukm} onChange={(v) => update("ikut_ukm", v)} cols={2} />
          </div>
          <SelectField label="Jumlah Tanggungan" value={String(form.tanggungan)} onChange={(v) => update("tanggungan", v)} options={["1", "2", "3", "4", "5"]} />
        </section>

        <button type="submit" disabled={loading} className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors">
          {loading ? (
            <>
              <Loader2 className="animate-spin" size={18} /> Memproses...
            </>
          ) : (
            <>
              <Sparkles size={18} /> Prediksi Sekarang
            </>
          )}
        </button>

        {error && <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 p-3 text-sm">{error}</div>}
      </form>

      {result && (
        <div className="mt-6 space-y-4">
          <ResultCard result={result} />
          <Link to="/pohon" className="flex items-center justify-center gap-2 py-3 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 font-medium hover:bg-indigo-100 transition-colors">
            <GitBranch size={18} /> Lihat jalur keputusan input ini di pohon
          </Link>
        </div>
      )}
    </div>
  );
}
