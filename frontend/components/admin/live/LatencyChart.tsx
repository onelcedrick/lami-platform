"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DataPoint {
  time: string;
  p50: number;
  p95: number;
}

export default function LatencyChart({ data }: { data: DataPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="card-admin flex h-[300px] items-center justify-center text-sm text-slate-400 dark:text-slate-500">
        Collecte des latences...
      </div>
    );
  }

  return (
    <div className="card-admin p-5">
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
        Latence API (ms)
      </h3>
      <div className="mt-4 h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
            <XAxis dataKey="time" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="p50"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              name="p50"
            />
            <Line
              type="monotone"
              dataKey="p95"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              name="p95"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
