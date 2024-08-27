import React from "react";
import { Grid } from "@mui/material";
import Motherboard from "./Motherboard";
import Memory from "./Memory";
import SystemHealth from "./SystemHealth";
import Drives from "./Drives";
import FileSystem from "./FileSystem";
import Processor from "./Processor";
import Network from "./Network";

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
