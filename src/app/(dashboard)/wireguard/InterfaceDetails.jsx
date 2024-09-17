"use client";

import React, { useState } from "react";
import { Grid, Card, CardContent, Typography, Box, IconButton, CircularProgress, Dialog, DialogContent, } from "@mui/material";
import { Delete, GetApp, QrCode } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedFetch, useAuthenticatedDelete } from "@/utils/customFetch";

const InterfaceDetails = ({ params }) => {
  const [qrCode, setQrCode] = useState(null); // State to hold the QR code data
  const [openDialog, setOpenDialog] = useState(false); // State to control the dialog
  const [loadingQr, setLoadingQr] = useState(false); // State for loading QR code
  const customFetch = useAuthenticatedFetch();
  const customDelete = useAuthenticatedDelete();
  const { id: interfaceName } = params;

  // Fetch the WireGuard interfaces
  const { data: WGinterfaces = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["WGinterfaces"],
    queryFn: () => customFetch("/api/wireguard/interfaces"),
  });

  if (isLoading) return <CircularProgress />;
  if (isError) return <Typography color="error">Failed to load interface details</Typography>;

  // Find the interface data that matches the current interface name
  const interfaceData = WGinterfaces.find((intf) => intf.name === interfaceName);

  if (!interfaceData) {
    return <Typography color="error">Interface not found</Typography>;
  }

  const peers = interfaceData.peerData || []; // Safely assign an empty array if peerData is undefined

  const handleDeletePeer = async (peerName) => {
    try {
      await customDelete(`/api/wireguard/${interfaceName}/${peerName}/remove`);
      refetch();  // Refetch data to update the UI after deletion
    } catch (error) {
      console.error("Failed to delete peer:", error);
    }
  };

  const handleDownloadConfig = (interfaceName, peerName) => {
    window.location.href = `/api/wireguard/${interfaceName}/${peerName}/config`;
  };

  const handleViewQrCode = async (peerName) => {
    setLoadingQr(true);
    try {
      const response = await customFetch(`/api/wireguard/${interfaceName}/${peerName}/qrcode`);
      setQrCode(response.qrcode); // Set the base64-encoded QR code
      setOpenDialog(true); // Open the dialog to show the QR code
    } catch (error) {
      console.error("Failed to fetch QR code:", error);
    } finally {
      setLoadingQr(false);
    }
  };

  return (
    <>
      <Grid container spacing={3}>
        {peers.length === 0 ? (
          <Typography>No peers found for this interface.</Typography>
        ) : (
          peers.map((peer) => (
            <Grid item xs={12} sm={6} md={6} lg={4} key={peer.name}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between">
                    <Box>
                      <Typography variant="h6" sx={{ fontSize: "1.1rem" }}>
                        {peer.name}
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="flex-end">
                      <IconButton
                        aria-label="Delete"
                        onClick={() => handleDeletePeer(peer.name)}
                        sx={{ color: "red" }}
                      >
                        <Delete />
                      </IconButton>
                      <IconButton
                        aria-label="Download Config"
                        onClick={() => handleDownloadConfig(interfaceName, peer.name)}
                      >
                        <GetApp />
                      </IconButton>
                      <IconButton
                        aria-label="View QR Code"
                        onClick={() => handleViewQrCode(peer.name)}
                      >
                        <QrCode />
                      </IconButton>
                    </Box>
                  </Box>
                  <Typography variant="body2">IP Address: {peer.addressIP}</Typography>
                  <Typography variant="body2">Allowed IP: {peer.allowedIPs}</Typography>
                  <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
                    Public Key: {peer.privateKey}
                  </Typography>
                  <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
                    Preshared Key: {peer.presharedKey}
                  </Typography>
                  <Typography variant="body2">Keep Alive: {peer.keepAlive}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))
        )}
      </Grid>

      {/* QR Code Dialog */}
      <Dialog
        open={openDialog}
        onClose={() => {
          setOpenDialog(false);
          setQrCode(null); // Reset QR code on dialog close
        }}
      >
        <DialogContent>
          {loadingQr ? (
            <Typography>Loading QR code...</Typography>
          ) : qrCode ? (
            <img src={qrCode} alt="QR Code" style={{ width: "100%" }} />
          ) : (
            <Typography>Failed to load QR code</Typography>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default InterfaceDetails;
