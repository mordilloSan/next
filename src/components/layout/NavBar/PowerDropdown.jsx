"use client";

import { useRef, useState } from "react";
import {
  Popper,
  Fade,
  Paper,
  ClickAwayListener,
  MenuList,
  MenuItem,
  Button,
} from "@mui/material";
import { Icon } from "@iconify/react";

const PowerDropdown = () => {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);

  const handleDropdownOpen = () => {
    setOpen((prev) => !prev);
  };

  const handleDropdownClose = (event) => {
    if (anchorRef.current && anchorRef.current.contains(event.target)) {
      return;
    }
    setOpen(false);
  };

  // Function to handle shutdown action
  const handleShutdown = async () => {
    try {
      const response = await fetch(`/api/power/shutdown`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (response.ok) {
        console.log("Shutdown initiated");
      } else {
        console.error("Failed to initiate shutdown");
      }
    } catch (error) {
      console.error("Error initiating shutdown:", error);
    }
  };

  // Function to handle reboot action
  const handleReboot = async () => {
    try {
      const response = await fetch("/api/power/reboot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (response.ok) {
        console.log("Reboot initiated");
      } else {
        console.error("Failed to initiate reboot");
      }
    } catch (error) {
      console.error("Error initiating reboot:", error);
    }
  };

  return (
    <>
      <div
        ref={anchorRef}
        onClick={handleDropdownOpen}
        className="cursor-pointer"
      >
        <Icon icon="mdi:power" width="28px" height="28px" />
      </div>

      <Popper
        open={open}
        transition
        disablePortal
        placement="bottom-end"
        anchorEl={anchorRef.current}
        className="min-w-[120px] mb-4 z-10"
      >
        {({ TransitionProps, placement }) => (
          <Fade
            {...TransitionProps}
            style={{
              transformOrigin:
                placement === "bottom-end" ? "right top" : "left top",
            }}
          >
            <Paper className="shadow-lg">
              <ClickAwayListener onClickAway={handleDropdownClose}>
                <MenuList>
                  {/* Shutdown Button */}
                  <MenuItem onClick={handleShutdown} className="gap-3">
                    <Button
                      fullWidth
                      variant="contained"
                      color="error"
                      size="small"
                    >
                      Shutdown
                    </Button>
                  </MenuItem>
                  {/* Reboot Button */}
                  <MenuItem className="gap-3">
                    <Button
                      onClick={handleReboot}
                      fullWidth
                      variant="contained"
                      color="primary"
                      size="small"
                    >
                      Reboot
                    </Button>
                  </MenuItem>
                </MenuList>
              </ClickAwayListener>
            </Paper>
          </Fade>
        )}
      </Popper>
    </>
  );
};

export default PowerDropdown;
