"use client";

import React, { useState } from "react";
import { Grid, Card, CardContent, Typography, CircularProgress, Box, IconButton } from "@mui/material";
import { Delete, Edit } from "@mui/icons-material";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthenticatedFetch, useAuthenticatedDelete, useAuthenticatedPost } from "@/utils/customFetch";
import { useSettings } from "@/hooks/useSettings";
import InterfaceDetails from "./InterfaceDetails";

const WireGuardDashboard = () => {
  const { settings } = useSettings();
  const customFetch = useAuthenticatedFetch();
  const customDelete = useAuthenticatedDelete();
  const customPost = useAuthenticatedPost();
  const [selectedInterface, setSelectedInterface] = useState(null);

  // Fetch the WireGuard interfaces
  const { data: WGinterfaces = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["WGinterfaces"],
    queryFn: () => customFetch("/api/wireguard/interfaces"),
    refetchInterval: 50000,
  });

  // Fetch network info
  const { data: networkData, isLoading: networkLoading, error: networkError } = useQuery({
    queryKey: ["networkInfo"],
    queryFn: () => customFetch(`/api/network`),
  });

  const handleDelete = async (interfaceName) => {
    try {
      await customDelete(`/api/wireguard/delete/${interfaceName}`);
      refetch();
      setSelectedInterface(null);
    } catch (error) {
      console.error("Failed to delete WireGuard interface:", error);
    }
  };

  const handleAddPeer = async (interfaceName, peerName) => {
    try {
      // Replace with the actual endpoint to add a peer
      await customPost(`/api/wireguard/${interfaceName}/${peerName}/add`);
      refetch();
    } catch (error) {
      console.error("Failed to add peer:", error);
    }
  };

  const handleToggleInterface = async (interfaceName, status) => {
    try {
      if (status !== "up" && status !== "down") {
        throw new Error('Action must be either "up" or "down".');
      }
      await customPost(`/api/wireguard/toggle/${interfaceName}`, { status });
      refetch();
    } catch (error) {
      console.error(`Failed to ${status} WireGuard interface:`, error);
    }
  };

  const handleSelectInterface = (iface) => {
    setSelectedInterface(iface.name === selectedInterface ? null : iface.name);
  };

  return (
    <>
      {isLoading ? (
        <CircularProgress />
      ) : isError ? (
        <Typography color="error">Failed to fetch interfaces</Typography>
      ) : WGinterfaces && WGinterfaces.length > 0 ? ( // Safeguard to ensure WGinterfaces is valid
        <>
          <AnimatePresence>
            <Grid container spacing={3}>
              {WGinterfaces.map((iface) => (
                selectedInterface === iface.name || selectedInterface === null ? (
                  <Grid item xs={12} md={6} lg={4} key={iface.name}>
                    <motion.div
                      initial={{ opacity: 0, y: -20 }} // Start slightly below
                      animate={{ opacity: 1, y: 0 }} // Move into place
                      exit={{ opacity: 0, y: 20 }} // Slide up and disappear
                      transition={{ duration: 0.3 }} // Adjust duration to slow down a bit
                      layout
                    >
                      <Card
                        style={{ cursor: "pointer" }}
                        onClick={() => handleSelectInterface(iface)}
                      >
                        <CardContent>
                          <Box display="flex" justifyContent="space-between" alignItems="center">
                            <Typography variant="h6" sx={{ fontSize: '1.1rem' }}>{iface.name}</Typography>
                            <Box>
                              <IconButton
                                sx={{ color: iface.isConnected === "Active" ? settings.primaryColor : "gray" }}
                                aria-label="Power"
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent the card click event
                                  handleToggleInterface(iface.name, iface.isConnected === "Active" ? "down" : "up");
                                }}
                              >
                                <PowerSettingsNewIcon />
                              </IconButton>
                              <IconButton
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent the card click event
                                  handleDelete(iface.name);
                                }}
                              >
                                <Delete />
                              </IconButton>
                              <IconButton
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent the card click event
                                  handleAddPeer(iface.name, "peerName"); // Replace "peerName" with actual value
                                }}
                              >
                                <Edit />
                              </IconButton>
                            </Box>
                          </Box>
                          <Typography variant="body2" color="textSecondary">
                            Address: {iface.address}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            Port: {iface.port}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            Peers: {iface.peerCount}
                          </Typography>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </Grid>
                ) : null
              ))}
            </Grid>
          </AnimatePresence>

          {/* Render InterfaceDetails in the same width as interface cards */}
          {selectedInterface && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={12} lg={12}>
                <motion.div
                  initial={{ opacity: 0, x: -20 }} // Slide in from left
                  animate={{ opacity: 1, x: 0 }} // Move into place
                  exit={{ opacity: 0, x: 20 }} // Slide out to right when disappearing
                  transition={{ duration: 0.5 }} // Slower transition
                  layout
                >
                  {/* Title for Clients Section */}
                  <Box mt={4} mb={2}>
                    <Typography variant="h5" gutterBottom>
                      Clients for {selectedInterface}
                    </Typography>
                  </Box>
                  <InterfaceDetails params={{ id: selectedInterface }} />
                </motion.div>
              </Grid>
            </Grid>
          )}
        </>
      ) : (
        <Typography color="textSecondary">No interfaces found</Typography>
      )}
    </>
  );
};

export default WireGuardDashboard;
