"use client";

import React from "react";
import { Box, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import LoadingIndicator from "@/components/LoadingIndicator";
import { useAuthenticatedFetch } from "@/utils/customFetch";

const extractNetworkStats = (data) => {
  if (!data || !data.interfaces) {
    return {
      totalInterfaces: 0,
      connectedInterfaces: 0,
      mainIP: "N/A",
    };
  }

  const interfaces = Object.entries(data.interfaces)
    .filter(([name]) => !name.startsWith("veth"))
    .reduce((acc, [name, details]) => {
      acc[name] = details;
      return acc;
    }, {});

  const totalInterfaces = Object.keys(interfaces).length;

  const connectedInterfaces = Object.values(interfaces).filter((iface) => {
    return iface.carrierSpeed; // An interface is considered connected if it has a carrierSpeed
  }).length;

  let mainIP = "N/A";
  for (const iface of Object.values(interfaces)) {
    if (iface.ip4 && iface.ip4.length > 0) {
      mainIP = iface.ip4.map((ip) => ip.address).join(", ");
      break;
    }
  }

  return { totalInterfaces, connectedInterfaces, mainIP };
};

const NetworkStatsInfo = () => {
  const customFetch = useAuthenticatedFetch();
  const { data, error, isLoading } = useQuery({
    queryKey: ["networkStats"],
    queryFn: () => customFetch("https://localhost:3000/api/network"),
    refetchInterval: 1000,
  });

  if (isLoading || error) {
    return <LoadingIndicator />;
  }

  const { totalInterfaces, connectedInterfaces, mainIP } =
    extractNetworkStats(data);

  return (
    <Box sx={{ display: "flex", gap: 1, flexDirection: "column", mt: -3.5 }}>
      <Typography variant="body1">
        <strong>Total Interfaces:</strong> {totalInterfaces}
      </Typography>
      <Typography variant="body1">
        <strong>Connected Interfaces:</strong> {connectedInterfaces}
      </Typography>
      <Typography variant="body1">
        <strong>Main IP:</strong> {mainIP}
      </Typography>
    </Box>
  );
};

export default NetworkStatsInfo;
