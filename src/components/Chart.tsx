import { useEffect, useRef } from 'react';
import {
  Chart, LineController, LineElement, PointElement, BarController, BarElement, LinearScale, CategoryScale, Tooltip,
  type ChartConfiguration, type Plugin,
} from 'chart.js';

Chart.register(LineController, LineElement, PointElement, BarController, BarElement, LinearScale, CategoryScale, Tooltip);

export const isDark = () => {
  const t = document.documentElement.dataset.theme;
  return t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
};

// Canvas не понимает CSS-переменные — читаем их значения
export function chartTheme() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  return { grid: v('--grid'), tick: v('--text-3'), text: v('--text'), surface: v('--surface'), border: v('--border'), font: v('--font') };
}

// Вертикальная линия-прицел под курсором
export const crosshair: Plugin = {
  id: 'crosshair',
  afterDatasetsDraw(chart) {
    const active = chart.tooltip?.getActiveElements();
    if (!active?.length) return;
    const x = active[0].element.x;
    const { top, bottom } = chart.chartArea;
    const ctx = chart.ctx;
    ctx.save();
    ctx.strokeStyle = chartTheme().border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
    ctx.restore();
  },
};

export function ChartCanvas({ config, label, height = 300, onReady }: {
  config: ChartConfiguration; label: string; height?: number; onReady?: (c: Chart) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chart = useRef<Chart>();

  useEffect(() => {
    if (!ref.current) return;
    chart.current?.destroy();
    chart.current = new Chart(ref.current, config);
    onReady?.(chart.current);
    return () => chart.current?.destroy();
    // конфиг пересоздаётся родителем при изменении данных
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  return (
    <div className="chart-box" style={{ height }}>
      <canvas ref={ref} role="img" aria-label={label} />
    </div>
  );
}
