import React from "react";
import { Button } from "@mui/material";

const NavbarButton = ({ onClick, icon, text }) => {
  return (
    <div>
      <Button
        onClick={onClick}
        fullWidth
        variant="text"
        startIcon={icon}
        disableRipple
        sx={{
          color: "var(--mui-palette-text-primary)",
          justifyContent: "flex-start",
          paddingLeft: 2,
          "&:hover": {
            backgroundColor: "transparent !important", // Added !important
          },
        }}
      >
        {text}
      </Button>
    </div>
  );
};

export default NavbarButton;
