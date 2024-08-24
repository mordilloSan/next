import React from "react";
import { Box } from "@mui/material";
import dynamic from "next/dynamic";

const UpdateCard = dynamic(() => import("./UpdateStatus"), { ssr: true });
const CollapsibleTable = dynamic(() => import("./UpdateHistory"), {
  ssr: true,
});

const Updates = () => {
  return (
    <Box>
      <UpdateCard />
      <CollapsibleTable />
    </Box>
  );
};

export default Updates;
