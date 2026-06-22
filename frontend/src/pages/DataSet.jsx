import { useEffect, useMemo, useState } from "react";
import { Loader2, Database, Search, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import { getDataset } from "../api.js";

const PAGE_SIZE = 15;

function StatusBadge({ value }) {
  const terima = String(value).toLowerCase() === "terima";
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${terima ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{value}</span>;
}

function formatCell(col, val) {
  if (val === null || val === undefined || val === "") return "-";
  if (col === "IPK") return Number(val).toFixed(2);
  if (col === "Tahun Lulus" || col === "SKS" || col === "Tanggungan") {
    return Number.isFinite(Number(val)) ? Math.round(Number(val)) : val;
  }
  return val;
}

export default function DataSet() {
  const [data, setData] = useState({ columns: [], rows: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getDataset()
      .then((d) => active && setData(d))
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data.rows;
    return data.rows.filter((row) =>
      Object.values(row).some((v) =>
        String(v ?? "")
          .toLowerCase()
          .includes(q),
      ),
    );
  }, [data.rows, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Nomor halaman dengan jendela (mis. 1 ... 4 5 6 ... 20).
  const pageNumbers = useMemo(() => {
    const delta = 1;
    const pages = [];
    const range = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= safePage - delta && i <= safePage + delta)) {
        range.push(i);
      }
    }
    let prev;
    for (const i of range) {
      if (prev && i - prev > 1) pages.push("...");
      pages.push(i);
      prev = i;
    }
    return pages;
  }, [totalPages, safePage]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="flex items-center gap-3">
        <span className="grid place-items-center w-11 h-11 rounded-xl bg-indigo-600 text-white">
          <Database size={22} />
        </span>
        <div>
          <h1 className="text-3xl font-bold">Dataset Mahasiswa</h1>
          <p className="text-slate-600">Data hasil pembersihan yang digunakan untuk melatih model.</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Cari nama, prodi, status..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <p className="text-sm text-slate-500">
          Menampilkan <strong>{filtered.length}</strong> dari <strong>{data.total}</strong> baris
        </p>
      </div>

      {/* States */}
      {loading && (
        <div className="mt-16 flex flex-col items-center text-slate-500">
          <Loader2 className="animate-spin" size={28} />
          <p className="mt-3">Memuat dataset...</p>
        </div>
      )}

      {error && !loading && (
        <div className="mt-8 flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 p-4">
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <>
          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-3 text-left font-semibold">#</th>
                  {data.columns.map((col) => (
                    <th key={col} className="px-3 py-3 text-left font-semibold whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageRows.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-3 py-2.5 text-slate-400">{(safePage - 1) * PAGE_SIZE + i + 1}</td>
                    {data.columns.map((col) => (
                      <td key={col} className="px-3 py-2.5 whitespace-nowrap text-slate-700">
                        {col === "Status Beasiswa" ? <StatusBadge value={row[col]} /> : formatCell(col, row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan={data.columns.length + 1} className="px-3 py-10 text-center text-slate-400">
                      Tidak ada data yang cocok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-5 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Halaman <strong>{safePage}</strong> dari <strong>{totalPages}</strong>
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg border border-slate-300 text-sm font-medium disabled:opacity-50 hover:bg-slate-50 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>

              {pageNumbers.map((p, i) =>
                p === "..." ? (
                  <span key={`e${i}`} className="px-2 text-slate-400 select-none">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`min-w-[2.25rem] px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${p === safePage ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}
                  >
                    {p}
                  </button>
                ),
              )}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg border border-slate-300 text-sm font-medium disabled:opacity-50 hover:bg-slate-50 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
