import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import RD3Tree from "react-d3-tree";
import { GitBranch, Loader2, RefreshCw, Database, Target, Info } from "lucide-react";
import { getTree, getTreeStructure, retrain } from "../api.js";
import { usePrediction } from "../context/PredictionContext.jsx";

/** Kumpulkan id node pada jalur keputusan prediksi terakhir. */
function usePathSet(lastPrediction) {
  return useMemo(() => {
    const path = lastPrediction?.result?.decision_path || [];
    return new Set(path);
  }, [lastPrediction]);
}

function CustomNode({ nodeDatum, pathSet, leafId }) {
  const onPath = pathSet.has(nodeDatum.id);
  const isLeaf = nodeDatum.is_leaf;
  const isFinal = nodeDatum.id === leafId;

  let bg = "bg-white border-slate-300";
  let text = "text-slate-700";
  if (isLeaf) {
    bg = nodeDatum.kelas === 1 ? "bg-emerald-50 border-emerald-300" : "bg-rose-50 border-rose-300";
    text = nodeDatum.kelas === 1 ? "text-emerald-700" : "text-rose-700";
  }
  const ring = onPath ? "ring-4 ring-indigo-400 shadow-lg shadow-indigo-200" : "";

  return (
    <foreignObject x={-95} y={-52} width={190} height={104} overflow="visible" style={{ overflow: "visible" }}>
      <div className="h-full w-full flex flex-col items-center" style={{ boxSizing: "border-box" }}>
        {nodeDatum.branch_label && (
          <span className={`z-10 -mb-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-sm ${nodeDatum.branch_label === "Ya" ? "bg-emerald-600 text-white" : "bg-slate-500 text-white"}`}>{nodeDatum.branch_label}</span>
        )}
        <div className={`flex-1 w-full rounded-xl border ${bg} ${ring} px-3 py-2 flex flex-col justify-center text-center transition-all`}>
          <p className={`text-[13px] font-semibold leading-tight ${text}`}>{nodeDatum.name}</p>
          <p className="mt-0.5 text-[10px] text-slate-400">
            {nodeDatum.samples} sampel
            {isFinal ? " · hasil input" : ""}
          </p>
        </div>
      </div>
    </foreignObject>
  );
}

export default function Tree() {
  const { lastPrediction } = usePrediction();
  const pathSet = usePathSet(lastPrediction);
  const leafId = lastPrediction?.result?.leaf_id ?? -1;

  const [data, setData] = useState(null);
  const [textData, setTextData] = useState(null);
  const [error, setError] = useState("");
  const [retraining, setRetraining] = useState(false);
  const [retrainMsg, setRetrainMsg] = useState("");

  const containerRef = useRef(null);
  const [translate, setTranslate] = useState({ x: 400, y: 70 });

  const load = useCallback(() => {
    setError("");
    Promise.all([getTreeStructure(), getTree()])
      .then(([struct, text]) => {
        setData(struct);
        setTextData(text);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (containerRef.current) {
      const { width } = containerRef.current.getBoundingClientRect();
      setTranslate({ x: width / 2, y: 70 });
    }
  }, [data]);

  async function onRetrain() {
    setRetraining(true);
    setRetrainMsg("");
    try {
      const res = await retrain();
      setRetrainMsg(`Model dilatih ulang: ${res.n_samples_base} data dasar + ` + `${res.n_samples_collected} terkumpul = ${res.n_samples_total} total ` + `(akurasi ${(res.accuracy * 100).toFixed(1)}%).`);
      load();
    } catch (e) {
      setRetrainMsg(`Gagal: ${e.message}`);
    } finally {
      setRetraining(false);
    }
  }

  const renderNode = useCallback((rd3Props) => <CustomNode {...rd3Props} pathSet={pathSet} leafId={leafId} />, [pathSet, leafId]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid place-items-center w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600">
            <GitBranch size={22} />
          </span>
          <div>
            <h1 className="text-3xl font-bold">Pohon Keputusan Interaktif</h1>
            <p className="text-slate-600">Diagram bercabang; jalur input prediksi terakhir disorot otomatis.</p>
          </div>
        </div>
        <button onClick={onRetrain} disabled={retraining} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors">
          {retraining ? (
            <>
              <Loader2 className="animate-spin" size={18} /> Melatih...
            </>
          ) : (
            <>
              <RefreshCw size={18} /> Latih Ulang dari Data Terbaru
            </>
          )}
        </button>
      </div>

      {/* Statistik & status */}
      {data && (
        <div className="mt-6 grid sm:grid-cols-3 gap-3">
          <div className="rounded-xl bg-white border border-slate-200 p-4 flex items-center gap-3">
            <Database className="text-indigo-600" size={20} />
            <div>
              <p className="text-xs text-slate-500">Total Data Latih</p>
              <p className="font-bold">{data.n_samples_total}</p>
            </div>
          </div>
          <div className="rounded-xl bg-white border border-slate-200 p-4 flex items-center gap-3">
            <RefreshCw className="text-indigo-600" size={20} />
            <div>
              <p className="text-xs text-slate-500">Data Terkumpul (input user)</p>
              <p className="font-bold">{data.n_samples_collected}</p>
            </div>
          </div>
          <div className="rounded-xl bg-white border border-slate-200 p-4 flex items-center gap-3">
            <Target className="text-indigo-600" size={20} />
            <div>
              <p className="text-xs text-slate-500">Akurasi</p>
              <p className="font-bold">{(data.accuracy * 100).toFixed(1)}%</p>
            </div>
          </div>
        </div>
      )}

      {retrainMsg && (
        <div className="mt-4 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-800 p-3 text-sm flex items-center gap-2">
          <Info size={16} /> {retrainMsg}
        </div>
      )}

      {lastPrediction ? (
        <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm text-slate-600">
          Menyorot jalur untuk input terakhir: IPK <strong>{lastPrediction.input.ipk}</strong>, Penghasilan <strong>{lastPrediction.input.penghasilan}</strong>, Organisasi <strong>{lastPrediction.input.ikut_organisasi}</strong>, UKM{" "}
          <strong>{lastPrediction.input.ikut_ukm}</strong> → <strong className={lastPrediction.result.label === 1 ? "text-emerald-600" : "text-rose-600"}>{lastPrediction.result.status}</strong>
        </div>
      ) : (
        <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 p-3 text-sm">
          Belum ada prediksi. Lakukan prediksi di halaman <strong>Prediksi</strong> untuk melihat jalur keputusan tersorot di sini.
        </div>
      )}

      {error && <div className="mt-6 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 p-4 text-sm">Tidak dapat memuat pohon: {error}. Pastikan backend berjalan.</div>}

      {/* Diagram interaktif */}
      <div ref={containerRef} className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/60 overflow-hidden" style={{ height: "560px" }}>
        {data?.tree ? (
          <RD3Tree
            data={data.tree}
            translate={translate}
            orientation="vertical"
            pathFunc="step"
            collapsible={false}
            zoomable
            scaleExtent={{ min: 0.3, max: 2 }}
            separation={{ siblings: 1.4, nonSiblings: 1.8 }}
            nodeSize={{ x: 210, y: 130 }}
            renderCustomNodeElement={renderNode}
          />
        ) : (
          !error && (
            <div className="h-full grid place-items-center text-slate-500">
              <span className="flex items-center gap-2">
                <Loader2 className="animate-spin" size={18} /> Memuat pohon...
              </span>
            </div>
          )
        )}
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Tip: scroll untuk zoom, drag untuk geser. Badge <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white">Ya</span> / <span className="px-1.5 py-0.5 rounded bg-slate-500 text-white">Tidak</span> menunjukkan jawaban kondisi
        dari node induk. Node dengan cincin biru = jalur yang dilalui input Anda.
      </p>

      {/* Aturan teks (cadangan) */}
      {textData?.rules && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-medium text-slate-600">Lihat aturan dalam bentuk teks</summary>
          <pre className="mt-3 rounded-2xl bg-slate-900 text-slate-100 p-5 text-xs overflow-x-auto leading-relaxed">{textData.rules}</pre>
        </details>
      )}
    </div>
  );
}
