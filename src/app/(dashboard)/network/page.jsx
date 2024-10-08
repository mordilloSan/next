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
    queryFn: () => customFetch(`/api/network/networkinfo`),
    refetchInterval: 1000,
  });

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (error) {
    return <Typography>Error loading network interfaces.</Typography>;
  }

  const { totalTxSec = 0, totalRxSec = 0, interfaces = [] } = networkInfo || {};

  const [formattedTotalTxValue, totalTxUnit] = formatDataRate(totalTxSec);
  const [formattedTotalRxValue, totalRxUnit] = formatDataRate(totalRxSec);

  const interfaceData = interfaces.map((details) => {
    const [formattedTxValue, txUnit] = formatDataRate(details.tx_sec || 0);
    const [formattedRxValue, rxUnit] = formatDataRate(details.rx_sec || 0);

    return {
      name: details.iface || "Unknown Interface",
      ipAddress:
        (Array.isArray(details.ip4) && details.ip4.length > 0
          ? details.ip4.map((ip) => ip.address).join(", ")
          : null) ||
        (Array.isArray(details.ip6) && details.ip6.length > 0
          ? details.ip6.map((ip) => ip.address).join(", ")
          : "N/A"),
      tx: formattedTxValue > 0 ? `${formattedTxValue} ${txUnit}` : "N/A",
      rx: formattedRxValue > 0 ? `${formattedRxValue} ${rxUnit}` : "N/A",
      carrierSpeed: details.carrierSpeed ? `${details.carrierSpeed}` : "N/A",
      vendor: details.vendor || "N/A",
      product: details.product || "N/A",
      description: details.description || "N/A",
    };
  });

  if (interfaceData.length === 0) {
    return <Typography>No network interfaces available.</Typography>;
  }

  return (
    <>
      <Typography variant="h6" gutterBottom>
        Total TX: {formattedTotalTxValue} {totalTxUnit}, Total RX: {formattedTotalRxValue} {totalRxUnit}
      </Typography>
      <Grid container spacing={2}>
        {interfaceData.map((iface) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={iface.name}>
            <NetworkInterfaceCard {...iface} />
          </Grid>
        ))}
      </Grid>
    </>
  );
};

export default NetworkStatsCards;
