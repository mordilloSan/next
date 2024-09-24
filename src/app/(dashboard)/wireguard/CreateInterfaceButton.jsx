"use client";

import React, { useState } from "react";
import { Button } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import CreateInterfaceDialog from "./CreateInterfaceDialog";
import { useAuthenticatedPost, useAuthenticatedFetch } from "@/utils/customFetch";

const CreateInterfaceButton = () => {
  const [serverName, setServerName] = useState("wg0");
  const [port, setPort] = useState("51820");
  const [CIDR, setCIDR] = useState("10.10.20.0/24");
  const [peers, setPeers] = useState("1");
  const [nic, setNic] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const customPost = useAuthenticatedPost();
  const customFetch = useAuthenticatedFetch();

  // Fetch the WireGuard interfaces
  const { refetch } = useQuery({queryKey: ["WGinterfaces"]});

  // Fetch network info
  const { data: networkData, isLoading: networkLoading, error: networkError } = useQuery({
    queryKey: ["networkInfo"],
    queryFn: () => customFetch(`/api/network/networkstats`),
  });

  // Function to extract physical NICs
  function getPhysicalNICs(data) {
    const interfaces = data?.interfaces || {};
    const physicalNICs = [];

    Object.keys(interfaces).forEach((nic) => {
      const nicData = interfaces[nic];
      const isPhysicalNIC = nic.startsWith("enp") && nicData.hardware && nicData.hardware.description;
      if (isPhysicalNIC) { physicalNICs.push(nic); }
    });
    return physicalNICs;
  }

  const handleCreateInterface = async () => {
    setLoading(true);
    setError(null);

    try {
      await customPost("/api/wireguard/create", { serverName, port, CIDR, peers, nic,  });
      setShowDialog(false);
      refetch();
    } catch (error) {
      console.error("Failed to create WireGuard interface:", error);
      setError("Failed to create interface");
    } finally {
      setLoading(false);
    }
  };

  const availableNICs = networkLoading || networkError ? [] : getPhysicalNICs(networkData);

  return (
    <>
      <Button variant="contained" color="primary" onClick={() => setShowDialog(true)}>
        Create New Interface
      </Button>
      <CreateInterfaceDialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        onCreate={handleCreateInterface}
        loading={loading}
        error={error}
        serverName={serverName}
        setServerName={setServerName}
        port={port}
        setPort={setPort}
        CIDR={CIDR}
        setCIDR={setCIDR}
        peers={peers}
        setPeers={setPeers}
        nic={nic}
        setNic={setNic}
        availableNICs={availableNICs}
      />
    </>
  );
};

export default CreateInterfaceButton;
