"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Grid, Card, CardContent, Typography, CircularProgress, Box, IconButton } from "@mui/material";
import { Delete, Edit } from "@mui/icons-material";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import { useAuthenticatedFetch, useAuthenticatedDelete, useAuthenticatedPost } from "@/utils/customFetch";
import { useSettings } from "@/hooks/useSettings";
import Link from "next/link";

const WireGuardDashboard = () => {
  const { settings } = useSettings();
  const customFetch = useAuthenticatedFetch();
  const customDelete = useAuthenticatedDelete();
  const customPost = useAuthenticatedPost();

  // Fetch the WireGuard interfaces
  const { data: WGinterfaces = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["WGinterfaces"],
    queryFn: () => customFetch("/api/wireguard/interfaces"),
    refetchInterval: 50000,
  });

  const handleDelete = async (interfaceName) => {
    try {
      await customDelete(`/api/wireguard/delete/${interfaceName}`);
      refetch();
    } catch (error) {
      console.error("Failed to delete WireGuard interface:", error);
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

  return (
    <>
      {isLoading ? (
        <CircularProgress />
      ) : isError ? (
        <Typography color="error">Failed to fetch interfaces</Typography>
      ) : (
        <Grid container spacing={3}>
          {!Array.isArray(WGinterfaces) || WGinterfaces.length === 0 ? (
            <Typography>No WireGuard interfaces found.</Typography>
          ) : (
            WGinterfaces.map((iface) => (
              <Grid item xs={12} md={6} lg={4} key={iface.name}>
                <Link href={`/wireguard/${iface.name}`} passHref>
                  <Card style={{ cursor: "pointer" }}>
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="h6">{iface.name}</Typography>
                        <Box>
                          <IconButton
                            sx={{ color: iface.isConnected === "Active" ? settings.primaryColor : "gray" }}
                            aria-label="Power"
                            onClick={(e) => {
                              e.preventDefault(); // Prevent the card click event
                              handleToggleInterface(iface.name, iface.isConnected === "Active" ? "down" : "up");
                            }}
                          >
                            <PowerSettingsNewIcon />
                          </IconButton>
                          <IconButton
                            onClick={(e) => {
                              e.preventDefault(); // Prevent the card click event
                              handleDelete(iface.name);
                            }}
                          >
                            <Delete />
                          </IconButton>
                          <IconButton onClick={() => console.log("Edit action for", iface.name)}>
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
                </Link>
              </Grid>
            ))
          )}
        </Grid>
      )}
    </>
  );
};

export default WireGuardDashboard;
