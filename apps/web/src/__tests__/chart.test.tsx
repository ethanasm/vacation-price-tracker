/**
 * Renders the shadcn chart wrapper against the REAL recharts package (only
 * ResponsiveContainer is pinned to a fixed size, since jsdom has no layout).
 * Guards the recharts major-version surface the trip-detail chart relies on:
 * context-injected tooltip props, the formatter path, and legend payload.
 */
import { render, screen, within } from "@testing-library/react";
import { Line, LineChart, XAxis } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

jest.mock("recharts", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const actual = jest.requireActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    ResponsiveContainer: (
      props: React.ComponentProps<typeof actual.ResponsiveContainer>
    ) =>
      React.createElement(actual.ResponsiveContainer, {
        ...props,
        width: 500,
        height: 300,
      }),
  };
});

const data = [
  { label: "Jul 1", total: 1250, minFlight: 420 },
  { label: "Jul 2", total: 1100, minFlight: 380 },
];

const config = {
  total: { label: "Total", color: "hsl(220 70% 50%)" },
  minFlight: { label: "Flight (min)", color: "hsl(160 60% 45%)" },
} satisfies ChartConfig;

function renderChart(tooltip: React.ReactElement | null = null) {
  return render(
    <ChartContainer config={config}>
      <LineChart data={data}>
        <XAxis dataKey="label" />
        {tooltip}
        <Line dataKey="total" isAnimationActive={false} />
        <Line dataKey="minFlight" isAnimationActive={false} />
      </LineChart>
    </ChartContainer>
  );
}

describe("chart wrapper with real recharts", () => {
  it("renders one path per series", () => {
    const { container } = renderChart();

    expect(container.querySelectorAll(".recharts-line")).toHaveLength(2);
  });

  it("renders tooltip content with context-injected payload", () => {
    const { container } = renderChart(
      <ChartTooltip
        active
        defaultIndex={1}
        content={<ChartTooltipContent />}
      />
    );

    const wrapper = container.querySelector(".recharts-tooltip-wrapper");
    expect(wrapper).not.toBeNull();
    const tooltip = within(wrapper as HTMLElement);

    // Header comes from the x-axis value, series labels from the chart
    // config, values from the active data point — all flow through the
    // payload recharts injects into the content element.
    expect(tooltip.getByText("Jul 2")).toBeInTheDocument();
    expect(tooltip.getByText("Total")).toBeInTheDocument();
    expect(tooltip.getByText("Flight (min)")).toBeInTheDocument();
    expect(tooltip.getByText("1,100")).toBeInTheDocument();
    expect(tooltip.getByText("380")).toBeInTheDocument();
  });

  it("runs the formatter used by the trip-detail chart", () => {
    renderChart(
      <ChartTooltip
        active
        defaultIndex={0}
        content={
          <ChartTooltipContent
            formatter={(value, name) => (
              <span data-testid={`formatted-${String(name)}`}>
                {config[name as keyof typeof config]?.label}: $
                {Number(value).toLocaleString()}
              </span>
            )}
          />
        }
      />
    );

    expect(screen.getByTestId("formatted-total")).toHaveTextContent(
      "Total: $1,250"
    );
    expect(screen.getByTestId("formatted-minFlight")).toHaveTextContent(
      "Flight (min): $420"
    );
  });

  it("renders legend content from the legend payload", () => {
    const { container } = render(
      <ChartContainer config={config}>
        <LineChart data={data}>
          <ChartLegend content={<ChartLegendContent />} />
          <Line dataKey="total" isAnimationActive={false} />
          <Line dataKey="minFlight" isAnimationActive={false} />
        </LineChart>
      </ChartContainer>
    );

    const legend = container.querySelector(".recharts-legend-wrapper");
    expect(legend).not.toBeNull();
    expect(within(legend as HTMLElement).getByText("Total")).toBeInTheDocument();
    expect(
      within(legend as HTMLElement).getByText("Flight (min)")
    ).toBeInTheDocument();
  });
});
