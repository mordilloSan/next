"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Button,
  TextField,
  Box,
  Alert,
  IconButton,
} from "@mui/material";
import { Delete, Edit } from "@mui/icons-material";
import { useAuthenticatedFetch } from "@/utils/customFetch";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import { useSettings } from "@/hooks/useSettings";

const WireGuardDashboard = () => {
  const { settings } = useSettings();
  const customFetch = useAuthenticatedFetch();
  const [name, setName] = useState("");
  const [port, setPort] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch the WireGuard interfaces
  const {
    data: WGinterfaces = [],
    isError,
    isLoading,
    refetch,
  } = useQuery({
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
        body: JSON.stringify({ name, port }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to create WireGuard interface");
      }

      setName("");
      setPort("");
      setShowForm(false);
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
        method: "DELETE", // Use DELETE method for removing resources
        headers: {
          "Content-Type": "application/json",
        },
      });
  
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
  
      // Refetch or update the UI as needed
      refetch();
    } catch (error) {
      console.error("Failed to delete WireGuard interface:", error);
    }
  };
  

  const handleToggleInterface = async (interfaceName, action) => {
    try {
      await fetch(`/api/wireguard/${action}`, {
        method: "POST",
        body: JSON.stringify({ name: interfaceName }),
        headers: {
          "Content-Type": "application/json",
        },
      });
      refetch();
    } catch (error) {
      console.error(`Failed to ${action} WireGuard interface:`, error);
    }
  };

  return (
    <>
      <Typography variant="h4" component="h1" gutterBottom>
        WireGuard Dashboard
      </Typography>

      {isLoading ? (
        <CircularProgress />
      ) : isError ? (
        <Typography color="error">Failed to fetch interfaces</Typography>
      ) : WGinterfaces.length === 0 ? (
        <div>
          <Typography>No WireGuard interfaces found.</Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={() => setShowForm(true)}
          >
            Create New Interface
          </Button>
          {showForm && (
            <Box mt={2}>
              <TextField
                label="Interface Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                fullWidth
                margin="normal"
              />
              <TextField
                label="Port"
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                fullWidth
                margin="normal"
              />
              <Button
                variant="contained"
                color="primary"
                onClick={handleCreateInterface}
                disabled={!name || !port || loading}
              >
                {loading ? "Creating..." : "Create Interface"}
              </Button>
              {error && <Alert severity="error">{error}</Alert>}
            </Box>
          )}
        </div>
      ) : (
        <Grid container spacing={3}>
          {WGinterfaces.map((iface) => (
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
          ))}
        </Grid>
      )}
    </>
  );
};

export default WireGuardDashboard;
