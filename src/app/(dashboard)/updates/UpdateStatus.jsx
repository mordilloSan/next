"use client";
import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import { Typography, Box, Button, LinearProgress, Card } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CollapsibleTable from "@/components/tables/CollapsibleTable";
import { useAuthenticatedFetch, useAuthenticatedPost } from "@/utils/customFetch";
import LoadingIndicator from "@/components/LoadingIndicator";

const UpdateStatus = () => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [currentPackage, setCurrentPackage] = useState("");
  const customFetch = useAuthenticatedFetch();
  const customPost = useAuthenticatedPost();

  const { data: updateInfo, isLoading: loadingSystemInfo, refetch } = useQuery({
    queryKey: ["updateInfo"],
    queryFn: () => customFetch(`/api/updates/status`),
    refetchInterval: 50000,
    enabled: !isUpdating, // Disable the query while updating
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
        await customPost(`/api/updates/update-package`, { packageName });
        setUpdateProgress(((i + 1) / totalPackages) * 100);
      } catch (error) {
        console.error(`Error updating package ${packageName}: ${error.message}`);
        continue;
      }
    }

    setIsUpdating(false);
    setCurrentPackage("");
    refetch();
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
        <Box sx={{ textAlign: "center" }}>
          <Typography variant="h6" gutterBottom>
            Updating {currentPackage}...
          </Typography>
          <LinearProgress variant="determinate" value={updateProgress} />
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
            color="primary"
            onClick={handleUpdateAll}
            disabled={isUpdating}
            sx={{ ml: 2, alignSelf: "center" }}
          >
            {isUpdating ? `Updating` : "Install All Updates"}
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
