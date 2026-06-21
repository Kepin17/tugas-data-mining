import { createContext, useContext, useEffect, useState } from "react";

const PredictionContext = createContext(null);
const STORAGE_KEY = "beasiswa:lastPrediction";

export function PredictionProvider({ children }) {
  const [lastPrediction, setLastPrediction] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (lastPrediction) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(lastPrediction));
      }
    } catch {
      /* ignore */
    }
  }, [lastPrediction]);

  return (
    <PredictionContext.Provider value={{ lastPrediction, setLastPrediction }}>
      {children}
    </PredictionContext.Provider>
  );
}

export function usePrediction() {
  const ctx = useContext(PredictionContext);
  if (!ctx) throw new Error("usePrediction harus dipakai di dalam PredictionProvider");
  return ctx;
}
