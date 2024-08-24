import dynamic from "next/dynamic";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

const ReactApexChart = ({ options, series, height = 135 }) => {
  return (
    <Chart
      options={options}
      series={series}
      type="line"
      width="100%"
      height={height}
    />
  );
};

export default ReactApexChart;
