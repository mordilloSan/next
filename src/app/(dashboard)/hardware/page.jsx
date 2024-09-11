import React from "react";
import { Grid } from "@mui/material";
import Motherboard from "../home/Motherboard";

const Dashboard = () => {
  return (
    <Grid container spacing={4}>

      <Grid item xs={12} md={6} lg={4}>
        <Motherboard />
      </Grid>

    </Grid>
  );
};

export default Dashboard;
