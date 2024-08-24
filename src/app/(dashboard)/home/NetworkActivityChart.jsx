"use client";

import React, { useEffect } from "react";
import { Box } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import ChartComponent from "@/components/charts/ReactApexChart";
import { graphRange } from "@/configs/cardConfig";
import { formatDataRate } from "@/utils/formatter";
import ApexCharts from "apexcharts";
import { useAuthenticatedFetch } from "@/utils/customFetch";

// Vars
const divider = "var(--mui-palette-divider)";
const disabledText = "var(--mui-palette-text-disabled)";

const chartOptions = {
  chart: {
    id: "network_realtime",
    animations: {
      enabled: true,
      easing: "linear",
      dynamicAnimation: {
        speed: 1000,
      },
    },
    toolbar: {
      show: false,
    },
    zoom: {
      enabled: false,
    },
  },
  grid: {
    padding: { top: -10 },
    borderColor: divider,
  },
  stroke: {
    curve: "smooth",
    width: 2.5,
  },
  markers: {
    size: 0,
  },
  xaxis: {
    axisBorder: { show: false },
    axisTicks: { color: divider },
    crosshairs: {
      stroke: { color: divider },
    },
    type: "datetime",
    range: graphRange,
    labels: {
      show: false,
      style: { colors: disabledText, fontSize: "12px" },
      format: "HH:mm:ss",
    },
  },
  yaxis: {
    forceNiceScale: true,
    labels: {
      show: true,
      style: { colors: disabledText, fontSize: "12px" },
      formatter: (val) => formatDataRate(val)[0],
    },
  },
  annotations: {
    yaxis: [
      {
        y: 0, // y value for the horizontal line
      },
    ],
  },
  tooltip: {
    enabled: false,
    y: {
      formatter: (val) => {
        const [formattedValue, unit] = formatDataRate(val);
        return `${formattedValue} ${unit}`;
      },
    },
    x: { show: false },
  },
  legend: {
    show: true,
    position: "bottom",
    offsetY: 5,
    itemMargin: {
      horizontal: 2,
      vertical: 0,
    },
    labels: {
      colors: disabledText,
    },
    formatter: (seriesName, opts) => {
      const seriesData = opts.w.config.series[opts.seriesIndex].data;
      const lastDataPoint = seriesData[seriesData.length - 1] || { y: 0 };
      const [formattedValue, unit] = formatDataRate(lastDataPoint.y);
      return `${seriesName}: ${Math.abs(formattedValue)} ${unit}`;
    },
  },
  series: [
    {
      name: "Down",
      data: [],
    },
    {
      name: "Up",
      data: [],
    },
  ],
};

const NetworkActivityChart = () => {
  const customFetch = useAuthenticatedFetch();
  const { data, error, isLoading } = useQuery({
    queryKey: ["networkStats"],
    queryFn: () => customFetch("https://localhost:3000/api/network"),
    refetchInterval: 1000,
  });

  useEffect(() => {
    if (data && !isLoading && !error) {
      const currentTime = new Date().getTime(); // Ensure correct timestamp format
      ApexCharts.exec("network_realtime", "appendData", [
        {
          name: "Download",
          data: [{ x: currentTime, y: data.totalRxSec }],
        },
        {
          name: "Upload",
          data: [{ x: currentTime, y: -data.totalTxSec }],
        },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box
      sx={{
        mt: {
          xs: 0,
          sm: 0,
          xl: -5,
        },
        width: {
          xs: "100%", // 100% width on extra-small screens
          sm: "100%", // 400px width on small screens
          xl: "100%",
        },
        minWidth: {
          xl: 190,
          sm: 250,
          xs: 400,
        },
      }}
    >
      <ChartComponent options={chartOptions} series={chartOptions.series} />
    </Box>
  );
};

export default NetworkActivityChart;
