import { useMemo } from "react";
import type { FunnelChartPayload } from "../dashboard/types";
import { useECharts, type DashboardEChartsOption } from "./useECharts";

interface FunnelChartProps {
  payload: FunnelChartPayload;
}

const FUNNEL_COLORS = ["#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef"];

export function FunnelChart({ payload }: FunnelChartProps): JSX.Element {
  const option = useMemo<DashboardEChartsOption>(
    () => ({
      backgroundColor: "transparent",
      animation: true,
      animationDuration: 700,
      tooltip: {
        trigger: "item",
        backgroundColor: "#0f2843",
        borderColor: "#3b82f6",
        borderWidth: 1,
        textStyle: { color: "#cfe4f8", fontSize: 12 },
        formatter: "{b}: {c}",
      },
      series: [
        {
          type: "funnel",
          left: "5%",
          width: "90%",
          top: 8,
          bottom: 8,
          sort: "descending",
          gap: 3,
          label: {
            show: true,
            position: "inside",
            formatter: (params: { name: string; value: unknown }) =>
              `${params.name}\n${Number(params.value).toLocaleString()}`,
            color: "#0f172a",
            fontSize: 12,
            fontWeight: "bold",
            lineHeight: 18,
          },
          itemStyle: {
            borderWidth: 0,
            borderRadius: 4,
          },
          data: payload.stages.map((stage, i) => ({
            name: stage.label,
            value: stage.value,
            itemStyle: { color: FUNNEL_COLORS[i % FUNNEL_COLORS.length] },
          })),
        },
      ],
    }),
    [payload]
  );

  const ref = useECharts(option);

  return <div ref={ref} className="funnel-widget-chart" />;
}
