"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { Typography, Box, Button, CircularProgress, Card } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CollapsibleTable from "@/components/tables/CollapsibleTable";
import LoadingIndicator from "@/components/LoadingIndicator";
import { useAuthenticatedFetch } from "@/utils/customFetch";

const endpointBase = "/api";

const UpdateStatus = () => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [currentPackage, setCurrentPackage] = useState("");
  const queryClient = useQueryClient();
  const customFetch = useAuthenticatedFetch();

  const { data: updateInfo, isLoading: loadingSystemInfo } = useQuery({
    queryKey: ["updateInfo"],
    queryFn: () => customFetch(`${endpointBase}/updates/status`),
    refetchInterval: 50000,
    enabled: !isUpdating, // Disable the query while updating
  });

  const updatePackageMutation = useMutation({
    mutationFn: async (packageName) => {
      const controller = new AbortController();

      try {
        const response = await fetch(`${endpointBase}/updates/update-package`, {
          method: "POST",
          body: JSON.stringify({ packageName }),
          headers: {
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        });

        if (response.status === 405) {
          throw new Error(
            "Method Not Allowed: The server does not support the requested HTTP method.",
          );
        }

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.message ||
              `Failed to update package: ${response.statusText}`,
          );
        }

        return response.json();
      } catch (error) {
        if (error.name === "AbortError") {
          throw new Error("Request timed out. Please try again.");
        }
        throw error;
      }
    },
    onSuccess: (data, variables) => {
      console.log(`${variables} updated successfully:`, data);
    },
    onError: (error, variables) => {
      console.error(`Error updating package ${variables}:`, error.message);
    },
  });

  const handleUpdateAll = async () => {
    if (!updateInfo || isUpdating) return;

    setIsUpdating(true);
    setUpdateProgress(0);
    setCurrentPackage("");

    const totalPackages = updateInfo.updates.length;

    for (let i = 0; i < totalPackages; i++) {
      const packageName = updateInfo.updates[i].package;

      setCurrentPackage(packageName); // Set the current package before starting the update

      try {
        console.log(`Updating package: ${packageName}`);
        await updatePackageMutation.mutateAsync(packageName);
        setUpdateProgress(((i + 1) / totalPackages) * 100);
      } catch (error) {
        console.error(
          `Error updating package ${packageName}: ${error.message}`,
        );
        continue;
      }
    }

    setIsUpdating(false);
    setCurrentPackage("");
    await queryClient.invalidateQueries(["updateInfo"]); // Invalidate the query after all updates are done
  };

  const columns = [
    { field: "name", headerName: "Name" },
    { field: "version", headerName: "Version" },
    { field: "cves", headerName: "CVE" },
    { field: "lps", headerName: "LP" },
  ];

  const rows =
    updateInfo?.updates?.map((update) => ({
      name: update.package,
      version: `${update.currentVersion} → ${update.availableVersion}`,
      cves: update.cves.length > 0 ? update.cves.join(", ") : "None",
      lps: update.lps.length > 0 ? update.lps.join(", ") : "None",
      changelog: update.changelog,
    })) || [];

  const renderCollapseContent = (row) => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Changelog
      </Typography>
      <Box>
        {row.changelog.length > 0 ? (
          row.changelog.map((entry, index) => (
            <Typography key={index} variant="body2" paragraph>
              {entry}
            </Typography>
          ))
        ) : (
          <Typography variant="body2" color="textSecondary">
            No changelog available.
          </Typography>
        )}
      </Box>
    </Box>
  );

  return (
    <Box>
      {/* Progress Bar and Current Package Display at the Top */}
      {isUpdating && (
        <Box sx={{ mb: 2, textAlign: "center" }}>
          <Typography variant="h6" gutterBottom>
            Updating {currentPackage}...
          </Typography>
          <CircularProgress variant="determinate" value={updateProgress} />
          <Typography variant="body2" sx={{ mt: 1 }}>
            {`${Math.round(updateProgress)}% completed`}
          </Typography>
        </Box>
      )}

      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          px: 2,
          pb: 1,
        }}
      >
        <Typography variant="h4" sx={{ lineHeight: 1.2 }}>
          Status
        </Typography>
        {updateInfo && updateInfo.updates.length > 0 && (
          <Button
            variant="contained"
            color="info"
            onClick={handleUpdateAll}
            disabled={isUpdating}
            startIcon={isUpdating ? <CircularProgress size={20} /> : null}
            sx={{ ml: 2, alignSelf: "center" }}
          >
            {isUpdating ? `Updating ${currentPackage}` : "Install All Updates"}
          </Button>
        )}
      </Box>
      {loadingSystemInfo ? (
        <Box sx={{ padding: 2 }}>
          <Card>
            <Box sx={{ py: 2.8 }}>
              <LoadingIndicator />
            </Box>
          </Card>
        </Box>
      ) : rows.length > 0 ? (
        <CollapsibleTable
          rows={rows}
          columns={columns}
          renderCollapseContent={renderCollapseContent}
        />
      ) : (
        <Box sx={{ padding: 2 }}>
          <Card>
            <Box sx={{ display: "flex", alignItems: "center", py: 5 }}>
              <CheckCircleIcon
                color="success"
                sx={{ ml: 9, mr: 8, fontSize: 22 }}
              />
              <Typography variant="body1" fontSize={15}>
                System is up to date
              </Typography>
            </Box>
          </Card>
        </Box>
      )}
    </Box>
  );
};

export default UpdateStatus;
