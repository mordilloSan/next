// StorageDashboard.js
"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/utils/customFetch";
import {
  Typography,
  Box,
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
<Typography>Teste</Typography>
  );
};

export default StorageDashboard;
