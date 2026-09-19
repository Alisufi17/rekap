"use client";

import { useEffect, useRef } from "react";
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
} from "chart.js";
import { fmtIDR } from "@/lib/format";

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

export default function TrendChart({
  buckets,
}: {
  buckets: { label: string; value: number }[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current?.destroy();
    chartRef.current = new Chart(canvasRef.current, {
      type: "bar",
      data: {
        labels: buckets.map((b) => b.label),
        datasets: [
          {
            data: buckets.map((b) => b.value),
            backgroundColor: "#0E7C5A",
            borderRadius: 5,
            maxBarThickness: 18,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => fmtIDR(c.parsed.y) } },
        },
        scales: {
          y: {
            ticks: {
              callback: (v) => {
                const n = Number(v);
                if (n >= 1_000_000) return n / 1_000_000 + "jt";
                if (n >= 1_000) return n / 1_000 + "rb";
                return n;
              },
              font: { size: 10 },
            },
            grid: { color: "#EEF0EB" },
          },
          x: { ticks: { font: { size: 9.5 } }, grid: { display: false } },
        },
      },
    });
    return () => chartRef.current?.destroy();
  }, [buckets]);

  return (
    <div className="rounded-xl border border-border bg-white p-3">
      <div className="relative h-40 lg:h-72">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
