// StorageDashboard.js
"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/utils/customFetch";
import {
  Typography,
  Box,
  Grid,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  Paper,
} from "@mui/material";
import StorageIcon from "@mui/icons-material/Storage";
import FolderSharedIcon from "@mui/icons-material/FolderShared";
import DriveEtaIcon from "@mui/icons-material/DriveEta";
import {  } from "@mui/material";
import Drives from "./Drives";

const StorageDashboard = () => {
  const customFetch = useAuthenticatedFetch();
  const { data: storageData, isLoading, error } = useQuery({
    queryKey: ["filesystemsInfo"],
    queryFn: () => customFetch(`/api/storage/filesystems`),
    refetchInterval: 1000,
  });

  if (isLoading) {
    return <Typography>Loading...</Typography>;
  }

  if (error) {
    return (
      <Typography color="error">
        {error.message || "Failed to fetch storage data"}
      </Typography>
    );
  }


  return (
    <Grid container spacing={4}>
      <Grid item xs={12} md={6} lg={4}>
        <Drives />
      </Grid>
    </Grid>
  );
};

export default StorageDashboard;