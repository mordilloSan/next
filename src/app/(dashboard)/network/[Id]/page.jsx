"use client";

import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Divider,
  Switch,
  IconButton,
} from "@mui/material";
import LoadingIndicator from "@/components/LoadingIndicator";
import { useAuthenticatedFetch } from "@/utils/customFetch";
import EditIcon from "@mui/icons-material/Edit";
import IPv4SettingsDialog from "./IPv4SettingsDialog"; // Adjust the path according to your structure

const NetworkDetails = ({ params }) => {
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleOpenDialog = () => {
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
  };

  const handleSaveSettings = (settings) => {
    console.log("Saved settings:", settings);
    // Here you can implement the logic to save the settings
  };
  const customFetch = useAuthenticatedFetch();
  const name = params.Id;
  const [nicEnabled, setNicEnabled] = useState(true);

  const { data: networkDetails, isLoading } = useQuery({
    queryKey: ["networkDetails"],
    queryFn: () => customFetch(`/api/network/networkstats`), // Fetch all network interfaces
    enabled: !!name, // Only run the query if `name` is defined
  });

  const handleToggle = async () => {
    try {
      // Toggle the NIC status (this would require an API call to actually enable/disable the NIC)
      await fetch(`/api/network/${name}/toggle`, {
        method: "POST",
        body: JSON.stringify({ enabled: !nicEnabled }),
      });
      setNicEnabled(!nicEnabled); // Update the state after successful API call
    } catch (error) {
      console.error("Failed to toggle NIC status", error);
    }
  };

  if (isLoading) {
    return (
      <Box
        mb={1.5}
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="100%"
      >
        <LoadingIndicator />
      </Box>
    );
  }

  // Filter out the specific network interface details
  const nicDetails = networkDetails?.interfaces?.[name];

  if (!nicDetails) {
    return (
      <Box
        mb={1.5}
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="100%"
      >
        <Typography variant="h6">
          Network interface not found - {name}
        </Typography>
      </Box>
    );
  }

  const isConnected = nicDetails.ip4.length > 0 || nicDetails.ip6.length > 0;

  return (
    <Box padding={2}>
      <Card>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <Typography variant="h5" gutterBottom>
                {name}
                <Switch
                  checked={nicEnabled}
                  onChange={handleToggle}
                  color="primary"
                  inputProps={{
                    "aria-label": "Enable/Disable Network Interface",
                  }}
                />
                <Typography variant="subtitle1" component="span">
                  {nicEnabled ? "Enabled" : "Disabled"}
                </Typography>
              </Typography>
            </Grid>
            <Grid item xs={12} md={6} style={{ textAlign: "right" }}>
              <Typography variant="body1" color="textSecondary">
                {`${nicDetails.hardware?.vendor || "Unknown Vendor"} ${nicDetails.hardware?.product || ""}`}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Divider />
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Status:
              </Typography>
              <Typography variant="body1" color="textSecondary">
                {isConnected ? "Connected" : "Not Connected"}
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Carrier:
              </Typography>
              <Typography variant="body1" color="textSecondary">
                {nicDetails.carrierSpeed || "N/A"} Mbps
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Divider />
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                IPv4:
              </Typography>
              <Typography variant="body1" color="textSecondary">
                Address {nicDetails.ip4[0]?.address}/
                {nicDetails.ip4[0]?.prefixLength}{" "}
                <IconButton size="small" onClick={handleOpenDialog}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Typography>
              <IPv4SettingsDialog
                open={dialogOpen}
                handleClose={handleCloseDialog}
                handleSave={handleSaveSettings}
              />
              <Typography variant="body1" color="textSecondary" gutterBottom>
                DNS: {nicDetails.dns.join(", ")}
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                IPv6:
              </Typography>
              <Typography variant="body1" color="textSecondary">
                Address {nicDetails.ip6[0]?.address || "Ignore"}{" "}
                <IconButton size="small">
                  <EditIcon fontSize="small" />
                </IconButton>
              </Typography>
              <Typography variant="body1" color="textSecondary" gutterBottom>
                DNS: {nicDetails.dns.join(", ")}
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                General:
              </Typography>
              <Box
                display="flex"
                alignItems="center"
                justifyContent="flex-start"
              >
                <Switch checked={nicDetails.autoConnect || false} />
                <Typography
                  variant="body1"
                  color="textSecondary"
                  style={{ marginLeft: "8px" }}
                >
                  Connect automatically
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                MTU:
              </Typography>
              <Typography variant="body1" color="textSecondary">
                Automatic{" "}
                <IconButton size="small">
                  <EditIcon fontSize="small" />
                </IconButton>
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default NetworkDetails;
