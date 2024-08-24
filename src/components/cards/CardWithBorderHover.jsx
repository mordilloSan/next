"use client"; // Enable client-side interactivity

import React from "react";
import { styled } from "@mui/material/styles";
import MuiCard from "@mui/material/Card";

const HoverableCard = styled(MuiCard)(({ color }) => ({
  transition:
    "border 0.3s ease-in-out, box-shadow 0.3s ease-in-out, margin 0.3s ease-in-out",
  borderBottomWidth: "2px",
  borderBottomColor: `var(--mui-palette-${color}-darkerOpacity)`,
  '[data-skin="bordered"] &:hover': {
    boxShadow: "none",
  },
  "&:hover": {
    borderBottomWidth: "3px",
    borderBottomColor: `var(--mui-palette-${color}-main) !important`,
    boxShadow: "var(--mui-customShadows-xl)",
    marginBlockEnd: "-1px",
  },
}));

const CardWithHover = ({ children, color = "primary" }) => {
  return <HoverableCard color={color}>{children}</HoverableCard>;
};

export default CardWithHover;
