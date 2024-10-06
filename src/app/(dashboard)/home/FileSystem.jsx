"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Typography, LinearProgress, Box, Tooltip } from "@mui/material";
import CardWithBorder from "@/components/cards/CardWithBorder";
import { useAuthenticatedFetch } from "@/utils/customFetch";
import LoadingIndicator from "@/components/LoadingIndicator";

const FsInfoCard = () => {
  const customFetch = useAuthenticatedFetch();
  const { data: fsInfo, isLoading } = useQuery({
    queryKey: ["fsInfo"],
    queryFn: () => customFetch("/api/storage/filesystems"),
    refetchInterval: 2000,
  });

  const fsSize = fsInfo ? Object.values(fsInfo) : [];

  const renderFsProgressBars = () => {
    if (!fsSize || fsSize.length === 0) {
      return "No system information available.";
    }

    return fsSize.map((fs, index) => {
      if (
        fs.MountedOn &&
        typeof fs.MountedOn === "string" &&
        !fs.MountedOn.startsWith("/var/lib/docker/") &&
        !fs.MountedOn.startsWith("/sys/firmware/") &&
        !fs.MountedOn.startsWith("/dev") &&
        !fs.MountedOn.startsWith("/run")
      ) {
        const usePercentage = parseFloat(fs.UsePercentage.replace("%", ""));

        return (
          <Tooltip
            key={index}
            title={`Available: ${fs.Available}`}
            placement="top"
            arrow
            PopperProps={{
              modifiers: [{ name: "offset", options: { offset: [0, -30] } }],
            }}
          >
            <Box>
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                mt={1.5}
              >
                <Typography variant="body2">{fs.MountedOn}</Typography>
                <Typography variant="body2">{`${fs.Used} of ${fs.Size}`}</Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={usePercentage}
                sx={{
                  height: 2,
                  borderRadius: 1,
                }}
              />
            </Box>
          </Tooltip>
        );
      }

      return null;
    });
  };

  const data = {
    title: "FileSystems",
    stats: isLoading ? <LoadingIndicator /> : renderFsProgressBars(),
    avatarIcon: "eos-icons:file-system",
  };

  return <CardWithBorder {...data} />;

};

export default FsInfoCard;
