"use client";

import { useQuery } from "@tanstack/react-query";
import React from "react";
import { Grid, Typography } from "@mui/material";
import { formatDataRate } from "@/utils/formatter";
import { useAuthenticatedFetch } from "@/utils/customFetch";
import NetworkInterfaceCard from "@/components/cards/NetworkInterfaceCard";
import LoadingIndicator from "@/components/LoadingIndicator";

const NetworkStatsCards = () => {
  const customFetch = useAuthenticatedFetch();
  const { data: networkInfo, isLoading, error } = useQuery({
    queryKey: ["networkInfo"],
    queryFn: () => customFetch(`/api/network/networkstats`),
    refetchInterval: 1000,
  });

  if (isLoading) {return (<LoadingIndicator />);}

  if (error) {
    return <Typography>Error loading network interfaces.</Typography>;
  }

  const interfaces = networkInfo
    ? Object.entries(networkInfo.interfaces)
        .filter(([name, details]) => details.managedByNetworkManager)
        .map(([name, details]) => {
          const [formattedTxValue, txUnit] = formatDataRate(details.txSec || 0);
          const [formattedRxValue, rxUnit] = formatDataRate(details.rxSec || 0);

          return {
            name,
            ipAddress: details.ip4?.map((ip) => ip.address).join(", ") || "N/A",
            tx: formattedTxValue > 0 ? `${formattedTxValue} ${txUnit}` : "N/A",
            rx: formattedRxValue > 0 ? `${formattedRxValue} ${rxUnit}` : "N/A",
            carrierSpeed: details.carrierSpeed || "N/A",
          };
        })
    : [];

  if (interfaces.length === 0) {
    return <Typography>No network interfaces available.</Typography>;
  }

  return (
    <Grid container spacing={2}>
      {interfaces.map((iface) => (
        <Grid item xs={12} sm={6} md={4} lg={3} key={iface.name}>
          <NetworkInterfaceCard {...iface} />
        </Grid>
      ))}
    </Grid>
  );
};

export default NetworkStatsCards;
