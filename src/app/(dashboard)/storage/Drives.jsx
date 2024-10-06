"use client";

import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Typography, Box, Divider } from "@mui/material";
import TemperatureIcon from "@mui/icons-material/Thermostat";
import SelectCard from "@/components/cards/SelectCard";
import { formatBytes } from "@/utils/formatter";
import { useAuthenticatedFetch } from "@/utils/customFetch";

const DriveInfo = () => {
  const customFetch = useAuthenticatedFetch();
  const [selectedDrive, setSelectedDrive] = useState(null);
  const { data: driveInfo } = useQuery({
    queryKey: ["drives"],
    queryFn: () => customFetch("/api/systeminfo/diskLayout"),
    refetchInterval: 50000,
  });

  useEffect(() => {
    if (driveInfo?.diskLayout && driveInfo.diskLayout.length > 0) {
      setSelectedDrive(driveInfo.diskLayout[0]);
    }
  }, [driveInfo]);

  const drives = driveInfo?.diskLayout || [];

  const handleSelect = (event) => {
    const selected = drives.find(
      (drive) => drive.device === event.target.value,
    );
    setSelectedDrive(selected);
  };

  return (
    <SelectCard
      title="Drive Info"
      icon_text={selectedDrive ? `${selectedDrive.temperature}°C` : "--°C"}
      icon={TemperatureIcon}
      iconProps={{ sx: { color: "grey" } }}
      options={drives.map((drive) => ({
        value: drive.device,
        label: drive.device,
      }))}
      onSelect={handleSelect}
      selectedOption={selectedDrive?.device || ""}
      selectedOptionLabel={selectedDrive?.device || "Select..."}
      Content={
        selectedDrive ? (
          <Box>
            <Typography variant="body2">
              <strong>Type:</strong> {selectedDrive.type}
            </Typography>
            <Divider sx={{ borderBottomWidth: 2, mb: 1, mt: 1 }} />
            <Typography variant="body2">
              <strong>Name:</strong> {selectedDrive.name}
            </Typography>
            <Divider sx={{ borderBottomWidth: 2, mb: 1, mt: 1 }} />
            <Typography variant="body2">
              <strong>Vendor:</strong> {selectedDrive.vendor}
            </Typography>
            <Divider sx={{ borderBottomWidth: 2, mb: 1, mt: 1 }} />
            <Typography variant="body2">
              <strong>Size:</strong> {formatBytes(selectedDrive.size)}
            </Typography>
          </Box>
        ) : (
          <Typography variant="body2">Select a drive to see details</Typography>
        )
      }
    />
  );
};

export default DriveInfo;
