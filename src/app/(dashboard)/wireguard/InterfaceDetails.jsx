"use client";

import React from "react";
import { Grid, Card, CardContent, Typography, Box, IconButton, CircularProgress } from "@mui/material";
import { Delete, GetApp, QrCode } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedFetch, useAuthenticatedDelete } from "@/utils/customFetch";

const InterfaceDetails = ({ params }) => {
  const customFetch = useAuthenticatedFetch();
  const customDelete = useAuthenticatedDelete();
  const { id: interfaceName } = params;

  // Fetch the interface details including peers and data usage
  const { data: interfaceData, isLoading, isError } = useQuery({
    queryKey: ["interfaceDetails", interfaceName],
    queryFn: () => customFetch(`/api/wireguard/interface/${interfaceName}/details`),
  });

  if (isLoading) return <CircularProgress />;
  if (isError) return <Typography color="error">Failed to load interface details</Typography>;

  const { peers } = interfaceData;

  const handleDeletePeer = async (peerPublicKey) => {
    try {
      await customDelete(`/api/wireguard/peer/${peerPublicKey}/delete`);
      // Refetch data after deletion if needed
    } catch (error) {
      console.error("Failed to delete peer:", error);
    }
  };

  const handleDownloadConfig = async (peerPublicKey) => {
    try {
      const config = await customFetch(`/api/wireguard/peer/${peerPublicKey}/config`);
      console.log("Config downloaded for:", peerPublicKey);
    } catch (error) {
      console.error("Failed to download config file:", error);
    }
  };

  const handleViewQrCode = (peerPublicKey) => {
    console.log("Show QR code for:", peerPublicKey);
  };

  return (
    <Grid container spacing={3}>
      {peers.length === 0 ? (
        <Typography>No peers found for this interface.</Typography>
      ) : (
        peers.map((peer) => (
          <Grid item xs={12} sm={6} md={6} lg={4} key={peer.publicKey}>
            <Card>
              <CardContent>
                {/* Action Buttons */}
                <Box display="flex" justifyContent="flex-end" mt={2}>
                  {/* Delete Button */}
                  <IconButton
                    aria-label="Delete"
                    onClick={() => handleDeletePeer(peer.publicKey)}
                    sx={{ color: "red" }}
                  >
                    <Delete />
                  </IconButton>

                  {/* Download Config Button */}
                  <IconButton
                    aria-label="Download Config"
                    onClick={() => handleDownloadConfig(peer.publicKey)}
                  >
                    <GetApp />
                  </IconButton>

                  {/* View QR Code Button */}
                  <IconButton
                    aria-label="View QR Code"
                    onClick={() => handleViewQrCode(peer.publicKey)}
                  >
                    <QrCode />
                  </IconButton>
                </Box>
                <Typography variant="body2">Allowed IP: {peer.allowedIPs}</Typography>
                <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                  Public Key: {peer.publicKey}
                </Typography>
                <Typography variant="body2">Data Sent: {peer.sentBytes} GB</Typography>
                <Typography variant="body2">Data Received: {peer.receivedBytes} GB</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))
      )}
    </Grid>
  );
};

export default InterfaceDetails;
