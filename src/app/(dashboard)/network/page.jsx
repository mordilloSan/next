"use client";

import { useQuery } from "@tanstack/react-query";
import React from "react";
import GenericTable from "@/components/tables/GenericTable";
import { formatDataRate } from "@/utils/formatter";
import { useAuthenticatedFetch } from "@/utils/customFetch";
import RouterLink from "@/components/RouterLink";

const NetworkStatsTable = () => {
  const customFetch = useAuthenticatedFetch();
  const { data: networkInfo, isLoading: networkInfoLoading, error: networkInfoError } = useQuery({
    queryKey: ["networkInfo"],
    queryFn: () => customFetch(`/api/network/networkstats`),
    refetchInterval: 1000,
  });

  const rows = networkInfo
    ? Object.entries(networkInfo.interfaces)
        .filter(([name, details]) => details.managedByNetworkManager)
        .map(([name, details]) => {
          const [formattedTxValue, txUnit] = formatDataRate(details.txSec || 0);
          const [formattedRxValue, rxUnit] = formatDataRate(details.rxSec || 0);

          return {
            name: (
              <RouterLink href={`/network/${name}`} passHref>
                {name}
              </RouterLink>
            ),
            ipAddress: details.ip4?.map((ip) => ip.address).join(", ") || "N/A",
            tx: formattedTxValue > 0 ? `${formattedTxValue} ${txUnit}` : "N/A",
            rx: formattedRxValue > 0 ? `${formattedRxValue} ${rxUnit}` : "N/A",
            carrierSpeed: details.carrierSpeed || "N/A",
          };
        })
    : [];

  const columns = [
    {
      id: "name",
      label: "Name",
      accessor: "name",
      sx: { minWidth: "100px", maxWidth: "100px", textAlign: "left" },
    },
    {
      id: "ipAddress",
      label: "IP Address",
      accessor: "ipAddress",
      sx: { minWidth: "150px", maxWidth: "150px" },
    },
    {
      id: "tx",
      label: "Tx",
      accessor: "tx",
      sx: { minWidth: "100px", maxWidth: "100px", textAlign: "center" },
    },
    {
      id: "rx",
      label: "Rx",
      accessor: "rx",
      sx: { minWidth: "100px", maxWidth: "100px", textAlign: "center" },
    },
    {
      id: "carrierSpeed",
      label: "Carrier Speed",
      accessor: "carrierSpeed",
      sx: { minWidth: "150px" },
    },
  ];

  return <GenericTable title="Interfaces" columns={columns} rows={rows} />;
};

export default NetworkStatsTable;
