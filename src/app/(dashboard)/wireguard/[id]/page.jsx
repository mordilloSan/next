"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { CircularProgress, Typography, Box } from "@mui/material";
import { useAuthenticatedFetch } from "@/utils/customFetch";

const InterfaceDetails = ({ params }) => {
  const customFetch = useAuthenticatedFetch();
  const { id: interfaceName } = params; // Extract interfaceName from params

  // Fetch the peer details for the specific WireGuard interface
  const { data: peers = [], isLoading, isError } = useQuery({
    queryKey: ["peerDetails", interfaceName], // queryKey should include interfaceName
    queryFn: () => customFetch(`/api/wireguard/interface/${interfaceName}/peers`), // Fetch peer details
  });

  if (isLoading) return <CircularProgress />;
  if (isError) return <Typography color="error">Failed to load peer details for {interfaceName}</Typography>;

  // Ensure the peers array is valid and contains peers
  if (peers.length === 0) {
    return <Typography>No peers found for interface {interfaceName}</Typography>;
  }

  return (
    <Box>
      <Typography variant="h4">Interface: {interfaceName}</Typography>

      <Typography variant="h6" mt={2}>Clients (Peers):</Typography>
      <ul>
        {peers.map((client) => (
          <li key={client.publicKey}>
            <Typography variant="body2">
              Client Public Key: {client.publicKey} | Allowed IPs: {client.allowedIPs} | Preshared Key: {client.presharedKey}
            </Typography>
          </li>
        ))}
      </ul>
    </Box>
  );
};

export default InterfaceDetails;
