"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Grid, Card, CardContent, Typography, CircularProgress, Button, TextField, Box, Alert, IconButton, } from "@mui/material";
import { Delete, Edit } from "@mui/icons-material";
import { useAuthenticatedFetch } from "@/utils/customFetch";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import { useSettings } from "@/hooks/useSettings";
import CreateInterfaceDialog from "./CreateInterfaceDialog";

const WireGuardDashboard = () => {
  const { settings } = useSettings();
  const customFetch = useAuthenticatedFetch();
  const [name, setName] = useState("wg0");
  const [port, setPort] = useState("51820");
  const [serverAddress, setServerAddress] = useState("10.13.14.1");
  const [peers, setPeers] = useState("1");
  const [showDialog, setShowDialog] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch WireGuard check status
  const { data: wireguardCheck, isLoading: loadingWireguardCheck, isError: errorWireguardCheck } = useQuery({
    queryKey: ["wireguardCheck"],
    queryFn: () => customFetch(`/api/wireguard/check`),
  });

  // Fetch the WireGuard interfaces
  const { data: WGinterfaces = [], isError, isLoading, refetch, } = useQuery({
    queryKey: ["WGinterfaces"],
    queryFn: () => customFetch("/api/wireguard/interfaces"),
    refetchInterval: 50000,
  });

  const handleCreateInterface = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/wireguard/create", {
        method: "POST",
        body: JSON.stringify({ name, port, serverAddress, peers }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to create WireGuard interface");
      }

      setName("");
      setPort("");
      setServerAddress("");
      setPeers("");
      setShowDialog(false); // Close dialog on success
      refetch(); // Refetch the interfaces to get the updated list
    } catch (error) {
      console.error("Failed to create WireGuard interface:", error);
      setError("Failed to create interface. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (interfaceName) => {
    try {
      const response = await fetch(`/api/wireguard/delete/${interfaceName}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
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

      const response = await fetch(`/api/wireguard/toggle/${interfaceName}`, {
        method: "POST",
        body: JSON.stringify({ status }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || "Failed to toggle WireGuard interface.",
        );
      }

      refetch();
    } catch (error) {
      console.error(`Failed to ${status} WireGuard interface:`, error);
    }
  };

  return (
    <>
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        mb={2}
      >
        <Typography variant="h4" component="h1">
          Interface Dashboard
        </Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={() => setShowDialog(true)}
        >
          Create New Interface
        </Button>
      </Box>

      {isLoading ? (
        <CircularProgress />
      ) : isError ? (
        <Typography color="error">Failed to fetch interfaces</Typography>
      ) : (
        <Grid container spacing={3}>
          {WGinterfaces.length === 0 ? (
            <Typography>No WireGuard interfaces found.</Typography>
          ) : (
            WGinterfaces.map((iface) => {
              const toggleAction = iface.status === "active" ? "down" : "up";

              return (
                <Grid item xs={12} md={6} lg={4} key={iface.name}>
                  <Card>
                    <CardContent>
                      <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Typography variant="h6">{iface.name}</Typography>
                        <Box>
                          <IconButton
                            sx={{
                              color:
                                iface.status === "active"
                                  ? settings.primaryColor
                                  : "gray",
                            }}
                            aria-label="Power"
                            onClick={() =>
                              handleToggleInterface(iface.name, toggleAction)
                            }
                          >
                            <PowerSettingsNewIcon />
                          </IconButton>
                          <IconButton onClick={() => handleDelete(iface.name)}>
                            <Delete />
                          </IconButton>
                          <IconButton
                            onClick={() =>
                              console.log("Edit action for", iface.name)
                            }
                          >
                            <Edit />
                          </IconButton>
                        </Box>
                      </Box>
                      <Typography variant="body2" color="textSecondary">
                        Status:{" "}
                        <span
                          style={{
                            color:
                              iface.status === "active"
                                ? settings.primaryColor
                                : "inherit",
                          }}
                        >
                          {iface.status}
                        </span>
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Clients: {iface.clients.length}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        tx/sec: 100 KB/s
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        rx/sec: 120 KB/s
                      </Typography>
                      <div>
                        {iface.clients.map((client, index) => (
                          <Typography
                            key={index}
                            variant="body2"
                            color="textSecondary"
                          >
                            {client.publicKey} - {client.allowedIPs}
                          </Typography>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })
          )}
        </Grid>
      )}

      {/* Create New Interface Section */}
      <CreateInterfaceDialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        onCreate={handleCreateInterface}
        loading={loading}
        error={error}
        name={name}
        setName={setName}
        port={port}
        setPort={setPort}
        serverAddress={serverAddress}
        setServerAddress={setServerAddress}
        peers={peers}
        setPeers={setPeers}
      />
    </>
  );
};

export default WireGuardDashboard;
