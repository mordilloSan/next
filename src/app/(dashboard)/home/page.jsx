import React from "react";
import { Grid } from "@mui/material";
import dynamic from "next/dynamic";

const Motherboard = dynamic(() => import("./Motherboard"), { ssr: true });
const Memory = dynamic(() => import("./Memory"), { ssr: true });
const SystemHealth = dynamic(() => import("./SystemHealth"), { ssr: true });
const Drives = dynamic(() => import("./Drives"), { ssr: true });
const FileSystem = dynamic(() => import("./FileSystem"), { ssr: true });
const Processor = dynamic(() => import("./Processor"), { ssr: true });
const Network = dynamic(() => import("./Network"), { ssr: true });

const Dashboard = () => {
  return (
    <Grid container spacing={4}>
      <Grid item xs={12} md={6} lg={4}>
        <SystemHealth />
      </Grid>
      <Grid item xs={12} md={6} lg={4}>
        <Processor />
      </Grid>
      <Grid item xs={12} md={6} lg={4}>
        <Memory />
      </Grid>
      <Grid item xs={12} md={6} lg={4}>
        <Network />
      </Grid>
      <Grid item xs={12} md={6} lg={4}>
        <Motherboard />
      </Grid>
      <Grid item xs={12} md={6} lg={4}>
        <Drives />
      </Grid>
      <Grid item xs={12} md={6} lg={4}>
        <FileSystem />
      </Grid>
    </Grid>
  );
};

export default Dashboard;
