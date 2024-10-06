"use client";

import React, { useState, useRef, useEffect } from "react";
import { Grid, Typography, CircularProgress, Box } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthenticatedFetch, useAuthenticatedDelete, useAuthenticatedPost, } from "@/utils/customFetch";
import { useSettings } from "@/hooks/useSettings";
import InterfaceDetails from "./InterfaceDetails";
import WireguardInterfaceCard from "@/components/cards/WireguardInterfaceCard";

const WireGuardDashboard = () => {
  const { settings } = useSettings();
  const customFetch = useAuthenticatedFetch();
  const customDelete = useAuthenticatedDelete();
  const customPost = useAuthenticatedPost();
  const [selectedInterface, setSelectedInterface] = useState(null);
  const selectedCardRef = useRef(null);
  const interfaceDetailsRef = useRef(null);

  // Fetch the WireGuard interfaces
  const {    data: WGinterfaces = [],    isLoading,    isError,    refetch,  } = useQuery({
    queryKey: ["WGinterfaces"],
    queryFn: () => customFetch("/api/wireguard/interfaces"),
    refetchInterval: 50000,
  });

  // Handle click outside to deselect interface and ESC key to deselect
  useEffect(() => {
    function handleClickOutside(event) {
      // Check for mousedown event
      if (event.type === 'mousedown') {
        if (
          selectedCardRef.current &&
          !selectedCardRef.current.contains(event.target) &&
          interfaceDetailsRef.current &&
          !interfaceDetailsRef.current.contains(event.target)
        ) {
          setSelectedInterface(null);
        }
      }
      // Check for keydown event
      else if (event.type === 'keydown') {
        if (event.key === 'Escape' || event.key === 'Esc') {
          setSelectedInterface(null);
        }
      }
    }

    if (selectedInterface) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleClickOutside);
    };
  }, [selectedInterface]);


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
      ) : WGinterfaces && WGinterfaces.length > 0 ? (
        <>
          <AnimatePresence>
            <Grid container spacing={3}>
              {WGinterfaces.map((iface) => (
                <Grid item xs={12} md={6} lg={4} key={iface.name}>
                  <WireguardInterfaceCard
                    iface={iface}
                    selectedInterface={selectedInterface}
                    selectedCardRef={
                      iface.name === selectedInterface ? selectedCardRef : null
                    }
                    primaryColor={settings.primaryColor}
                    handleSelectInterface={handleSelectInterface}
                    handleToggleInterface={handleToggleInterface}
                    handleDelete={handleDelete}
                    handleAddPeer={handleAddPeer}
                  />
                </Grid>
              ))}
            </Grid>
          </AnimatePresence>

          {selectedInterface && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={12} lg={12}>
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.5 }}
                  layout
                >
                  <Box mt={4} mb={2}>
                    <Typography variant="h5" gutterBottom>
                      Clients for {selectedInterface}
                    </Typography>
                  </Box>
                  <div ref={interfaceDetailsRef}>
                    <InterfaceDetails params={{ id: selectedInterface }} />
                  </div>
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
