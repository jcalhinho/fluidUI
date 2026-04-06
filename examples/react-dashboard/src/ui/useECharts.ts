import type { LineSeriesOption, FunnelSeriesOption } from "echarts/charts";
import { LineChart, FunnelChart } from "echarts/charts";
import type {
  GridComponentOption,
  TooltipComponentOption,
} from "echarts/components";
import { GridComponent, TooltipComponent } from "echarts/components";
import { init, type ComposeOption, type EChartsType, use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { useEffect, useRef } from "react";

use([LineChart, FunnelChart, GridComponent, TooltipComponent, CanvasRenderer]);

export type DashboardEChartsOption = ComposeOption<
  | LineSeriesOption
  | FunnelSeriesOption
  | GridComponentOption
  | TooltipComponentOption
>;

/**
 * Initialize an ECharts instance on a div, manage lifecycle and resize updates.
 * Returns a ref to attach to the chart container div.
 */
export function useECharts(
  option: DashboardEChartsOption | null
): React.RefObject<HTMLDivElement> {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<EChartsType | null>(null);

  // Init / dispose
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const chart = init(el, null, { renderer: "canvas" });
    chartRef.current = chart;

    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  // Update option
  useEffect(() => {
    if (chartRef.current && option) {
      chartRef.current.setOption(option, { notMerge: true, lazyUpdate: true });
    }
  }, [option]);

  return ref;
}
