import { Link, NavLink, Route, Routes } from "react-router-dom";
import { GraduationCap, Github } from "lucide-react";
import Home from "./pages/Home.jsx";
import Predict from "./pages/Predict.jsx";
import Tree from "./pages/Tree.jsx";

function NavItem({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? "bg-indigo-600 text-white"
            : "text-slate-600 hover:bg-slate-100"
        }`
      }
    >
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
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/prediksi" element={<Predict />} />
          <Route path="/pohon" element={<Tree />} />
        </Routes>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 py-6 text-sm text-slate-500 flex items-center justify-between">
          <p>Sistem Prediksi Kelayakan Beasiswa — Decision Tree</p>
          <a
            href="#"
            className="flex items-center gap-1 hover:text-slate-800"
          >
            <Github size={16} /> Proyek Tim
          </a>
        </div>
      </footer>
    </div>
  );
}
