"use client";

import { useEffect, useState } from "react";
import { formatAriary } from "@/lib/currency";

interface PriceRangeSliderProps {
  min: number;
  max: number;
  value: [number, number];
  onChange: (range: [number, number]) => void;
}

export default function PriceRangeSlider({
  min,
  max,
  value,
  onChange,
}: PriceRangeSliderProps) {
  const [local, setLocal] = useState<[number, number]>(value);

  // Sync avec les props
  useEffect(() => {
    setLocal(value);
  }, [value]);

  const [minVal, maxVal] = local;
  const range = max - min || 1;

  const leftPct = ((minVal - min) / range) * 100;
  const rightPct = ((maxVal - min) / range) * 100;

  const handleMinChange = (v: number) => {
    const next = Math.min(v, maxVal - 1000); // marge 1000 Ar
    setLocal([next, maxVal]);
    onChange([next, maxVal]);
  };

  const handleMaxChange = (v: number) => {
    const next = Math.max(v, minVal + 1000);
    setLocal([minVal, next]);
    onChange([minVal, next]);
  };

  return (
    <div>
      {/* Affichage des valeurs */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {formatAriary(minVal)}
        </span>
        <span className="text-slate-400">→</span>
        <span className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {formatAriary(maxVal)}
        </span>
      </div>

      {/* Slider */}
      <div className="relative mt-4 h-6">
        {/* Track de fond */}
        <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-200 dark:bg-slate-700" />

        {/* Track actif (entre les deux poignées) */}
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-primary-500"
          style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }}
        />

        {/* Input range MIN (invisible, au-dessus) */}
        <input
          type="range"
          min={min}
          max={max}
          value={minVal}
          onChange={(e) => handleMinChange(Number(e.target.value))}
          className="pointer-events-none absolute left-0 top-0 h-6 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-primary-600 [&::-webkit-slider-thumb]:shadow-md"
          style={{ zIndex: minVal > max - 100 ? 5 : 3 }}
        />

        {/* Input range MAX (invisible, au-dessus) */}
        <input
          type="range"
          min={min}
          max={max}
          value={maxVal}
          onChange={(e) => handleMaxChange(Number(e.target.value))}
          className="pointer-events-none absolute left-0 top-0 h-6 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-primary-600 [&::-webkit-slider-thumb]:shadow-md"
          style={{ zIndex: 4 }}
        />
      </div>
    </div>
  );
}