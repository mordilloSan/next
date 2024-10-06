// StorageDashboard.js

import React from "react";
import {Grid} from "@mui/material";
import Drives from "./Drives";

const StorageDashboard = () => {

  return (
    <Grid container spacing={4}>
      <Grid item xs={12} md={6} lg={4}>
        <Drives />
      </Grid>
    </Grid>
  );
};

export default StorageDashboard;