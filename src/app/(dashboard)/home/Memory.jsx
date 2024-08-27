"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Typography, Box } from "@mui/material";
import CardWithBorder from "@/components/cards/CardWithBorder";
import CircularProgressWithLabel from "../../../components/CircularProgress";
import { useAuthenticatedFetch } from "@/utils/customFetch";

// Utility functions
const formatBytesToGB = (bytes) => (bytes / 1000 ** 3).toFixed(2);
const calculatePercentage = (used, total) => ((used / total) * 100).toFixed(2);

const MemoryUsage = () => {
  const customFetch = useAuthenticatedFetch();
  const { data: memoryData } = useQuery({
    queryKey: ["memoryInfo"],
    queryFn: () => customFetch("/api/systeminfo/mem"),
    refetchInterval: 2000,
  });

  // Calculate percentages
  const ramUsagePercentage = memoryData?.mem?.active
    ? parseFloat(
        calculatePercentage(memoryData.mem.active, memoryData.mem.total),
      )
    : 0;

  const data = {
    title: "Memory Usage",
    stats: (
      <CircularProgressWithLabel
        value={ramUsagePercentage}
        size={120}
        thickness={4}
      />
    ),
    stats2: (
      <Box sx={{ display: "flex", gap: 1, flexDirection: "column" }}>
        <Typography variant="body1">
          <strong>Total Memory:</strong>{" "}
          {formatBytesToGB(memoryData?.mem?.total || 0)} GB
        </Typography>
        <Typography variant="body1">
          <strong>Used Memory:</strong>{" "}
          {formatBytesToGB(memoryData?.mem?.active || 0)} GB
        </Typography>
        <Typography variant="body1">
          <strong>Swap:</strong>{" "}
          {formatBytesToGB(memoryData?.mem?.swapused || 0)} of{" "}
          {formatBytesToGB(memoryData?.mem?.swaptotal || 0)} GB
        </Typography>
      </Box>
    ),

    avatarIcon: "la:memory",
  };

  return <CardWithBorder {...data} />;
};

export default MemoryUsage;
