import { Link, NavLink, Route, Routes } from "react-router-dom";
import { GraduationCap, Github, GitBranch, Sparkles, ArrowUpRight } from "lucide-react";
import Home from "./pages/Home.jsx";
import Predict from "./pages/Predict.jsx";
import Tree from "./pages/Tree.jsx";
import DataSet from "./pages/DataSet.jsx";

const GITHUB_URL = "https://github.com/Kepin17/tugas-data-mining";

function NavItem({ to, children }) {
  return (
    <NavLink to={to} className={({ isActive }) => `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
      {children}
    </NavLink>
  );
}

export default function App() {
  return (
    <div className="min-h-screen flex flex-col font-sans text-slate-800">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg">
            <span className="grid place-items-center w-9 h-9 rounded-xl bg-indigo-600 text-white">
              <GraduationCap size={20} />
            </span>
            <span>BeasiswaAI</span>
          </Link>
          <nav className="flex items-center gap-1">
            <NavItem to="/">Beranda</NavItem>
            <NavItem to="/prediksi">Prediksi</NavItem>
            <NavItem to="/pohon">Pohon Keputusan</NavItem>
            <NavItem to="/dataset">Dataset</NavItem>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/prediksi" element={<Predict />} />
          <Route path="/pohon" element={<Tree />} />
          <Route path="/dataset" element={<DataSet />} />
        </Routes>
      </main>

      <footer className="mt-16 border-t border-slate-200 bg-gradient-to-b from-white to-slate-50">
        <div className="max-w-5xl mx-auto px-4 py-12">
          <div className="grid gap-10 md:grid-cols-3">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 font-bold text-lg">
                <span className="grid place-items-center w-9 h-9 rounded-xl bg-indigo-600 text-white">
                  <GraduationCap size={20} />
                </span>
                <span>BeasiswaAI</span>
              </div>
              <p className="mt-3 text-sm text-slate-500 leading-relaxed">
                Sistem prediksi kelayakan beasiswa berbasis <span className="font-medium text-slate-700">Decision Tree</span> yang transparan dan dapat dijelaskan.
              </p>
              <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-slate-800 transition-colors">
                <Github size={16} /> Lihat di GitHub
                <ArrowUpRight size={15} className="opacity-70" />
              </a>
            </div>

            {/* Navigasi */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Navigasi</h3>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li>
                  <Link to="/" className="text-slate-600 hover:text-indigo-600 transition-colors">
                    Beranda
                  </Link>
                </li>
                <li>
                  <Link to="/prediksi" className="text-slate-600 hover:text-indigo-600 transition-colors">
                    Prediksi
                  </Link>
                </li>
                <li>
                  <Link to="/pohon" className="text-slate-600 hover:text-indigo-600 transition-colors">
                    Pohon Keputusan
                  </Link>
                </li>
                <li>
                  <Link to="/dataset" className="text-slate-600 hover:text-indigo-600 transition-colors">
                    Dataset
                  </Link>
                </li>
              </ul>
            </div>

            {/* Teknologi */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Teknologi</h3>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
                <li className="flex items-center gap-2">
                  <Sparkles size={15} className="text-indigo-500" /> FastAPI + scikit-learn
                </li>
                <li className="flex items-center gap-2">
                  <GitBranch size={15} className="text-indigo-500" /> Decision Tree Classifier
                </li>
                <li className="flex items-center gap-2">
                  <GraduationCap size={15} className="text-indigo-500" /> React + Tailwind CSS
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-400">
            <p>&copy; {new Date().getFullYear()} BeasiswaAI — Proyek Tugas Data Mining.</p>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-slate-700 transition-colors">
              <Github size={15} /> github.com/Kepin17/tugas-data-mining
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
