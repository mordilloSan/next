"use client";

import React, { useState } from "react";
import { Button } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import CreateInterfaceDialog from "./CreateInterfaceDialog";
import { useAuthenticatedPost } from "@/utils/customFetch"; // Import the custom post hook

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

  // Fetch the WireGuard interfaces
  const { refetch } = useQuery({
    queryKey: ["WGinterfaces"],
  });

  const handleCreateInterface = async () => {
    setLoading(true);
    setError(null);

    try {
      await customPost("/api/wireguard/create", { serverName, port, CIDR, peers, nic, });
      setShowDialog(false);
      refetch();
    } catch (error) {
      console.error("Failed to create WireGuard interface:", error);
    } finally {
      setLoading(false);
    }
  };

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
      />
    </>


  );
};

export default CreateInterfaceButton;
