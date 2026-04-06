import { useMemo } from "react";
import type { LineChartPayload } from "../dashboard/types";
import { useECharts, type DashboardEChartsOption } from "./useECharts";

interface LineChartProps {
  payload: LineChartPayload;
}

function toneColor(tone: LineChartPayload["tone"]): string {
  if (tone === "positive") return "#22c55e";
  if (tone === "negative") return "#ef4444";
  return "#60a5fa";
}

export function LineChart({ payload }: LineChartProps): JSX.Element {
  const color = toneColor(payload.tone);

  const option = useMemo<DashboardEChartsOption>(
    () => ({
      backgroundColor: "transparent",
      animation: true,
      animationDuration: 600,
      grid: { top: 8, right: 8, bottom: 28, left: 36, containLabel: false },
      xAxis: {
        type: "category",
        data: payload.labels,
        axisLine: { lineStyle: { color: "#c7d4e8" } },
        axisTick: { show: false },
        axisLabel: { color: "#8ba3c0", fontSize: 11 },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: "#8ba3c0", fontSize: 11 },
        splitLine: { lineStyle: { color: "#e8eef8", type: "dashed" } },
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: "#0f2843",
        borderColor: "#3b82f6",
        borderWidth: 1,
        textStyle: { color: "#cfe4f8", fontSize: 12 },
        formatter: (params: unknown) => {
          const p = (params as { name: string; value: number }[])[0];
          return `<b>${p.name}</b><br/>${p.value} ${payload.unit}`;
        },
      },
      series: [
        {
          type: "line",
          data: payload.points,
          smooth: true,
          symbol: "circle",
          symbolSize: 6,
          lineStyle: { color, width: 2.5 },
          itemStyle: { color, borderWidth: 2, borderColor: "#fff" },
          areaStyle: {
            color: {
              type: "linear",
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: color + "44" },
                { offset: 1, color: color + "05" },
              ],
            },
          },
        },
      ],
    }),
    [payload, color]
  );

  const ref = useECharts(option);

  return (
    <div className="line-widget">
      <div className="line-widget-meta">
        <span className={`line-change tone-${payload.tone}`}>{payload.change}</span>
        <span className="line-unit">{payload.unit}</span>
      </div>
      <div ref={ref} className="line-widget-chart" />
      <div className="line-widget-axis">
        <span>{payload.labels[0] ?? ""}</span>
        <span>{payload.labels[payload.labels.length - 1] ?? ""}</span>
      </div>
    </div>
  );
}
