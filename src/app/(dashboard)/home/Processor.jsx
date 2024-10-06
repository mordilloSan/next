"use client";

import React from "react";
import TemperatureIcon from "@mui/icons-material/Thermostat";
import { Box, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import CardWithBorder from "@/components/cards/CardWithBorder";
import CircularProgressWithLabel from "../../../components/CircularProgress";
import { useAuthenticatedFetch } from "@/utils/customFetch";

const Processor = () => {
  const customFetch = useAuthenticatedFetch();
  const { data: CPUInfo } = useQuery({
    queryKey: ["CPUInfo"],
    queryFn: () => customFetch("/api/systeminfo/cpu"),
    refetchInterval: 2000,
  });

  const getCPUModel = () => {
    if (CPUInfo?.cpu) {
      const manufacturer = CPUInfo.cpu.manufacturer;
      const model = CPUInfo.cpu.brand
        .replace(/ To Be Filled By O.E.M\./g, "")
        .trim();
      return `${manufacturer} ${model}`;
    }
    return "No data";
  };

  const averageCpuUsage = CPUInfo?.currentLoad
    ? CPUInfo.currentLoad.cpus.reduce((sum, cpu) => sum + cpu.load, 0) /
      CPUInfo.currentLoad.cpus.length
    : 0;

  const IconText = CPUInfo?.temperatures?.max
    ? `${CPUInfo.temperatures.max}°C`
    : "--°C";

  const data = {
    title: "Processor",
    avatarIcon: "ph:cpu",
    stats: (
      <CircularProgressWithLabel
        value={averageCpuUsage}
        size={120}
        thickness={4}
      />
    ),
    stats2: (
      <Box sx={{ display: "flex", gap: 1, flexDirection: "column" }}>
        <Typography variant="body1">
          <strong> CPU: </strong>
          {getCPUModel()}
        </Typography>
        <Typography variant="body1">
          <strong>Cores:</strong> {CPUInfo?.cpu?.cores || 0} Threads
        </Typography>
        <Typography variant="body1">
          <strong>Max Usage:</strong>{" "}
          {Math.max(
            ...(CPUInfo?.currentLoad?.cpus?.map((cpu) => cpu.load) || [0]),
          ).toFixed(0)}
          %
        </Typography>
      </Box>
    ),
    icon_text: IconText,
    icon: TemperatureIcon,
    iconProps: { sx: { color: "grey" } },
  };

  return <CardWithBorder {...data} />;
};

export default Processor;
