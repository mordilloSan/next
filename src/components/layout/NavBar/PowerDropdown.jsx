"use client";

import { useRef, useState, useEffect } from "react";
import { Popper, Fade, Paper, ClickAwayListener, MenuList, MenuItem, Button, Divider, Chip } from "@mui/material";
import { Icon } from "@iconify/react";
import { useAuth } from "@/contexts/AuthContext";

const PowerDropdown = () => {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const { logout } = useAuth();
  const [username, setUsername] = useState("");

  useEffect(() => {
    const fetchUsername = () => {
      const cookieName = "token=";
      const decodedCookie = decodeURIComponent(document.cookie);
      const cookieArray = decodedCookie.split(";");
      let token = "";

      // Find the token cookie
      cookieArray.forEach((cookie) => {
        let c = cookie.trim();
        if (c.indexOf(cookieName) === 0) {
          token = c.substring(cookieName.length, c.length);
        }
      });

      if (token) {
        try {
          const parsedToken = JSON.parse(token);
          setUsername(parsedToken.username || "Username");
        } catch (error) {
          console.error("Failed to parse token:", error);
          setUsername("Username");
        }
      }
    };

    fetchUsername();
  }, []);


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

  // Function to handle logout action
  const handleUserLogout = () => {
    logout();
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
        <Icon icon="mdi:power" width="24x" height="24px" />
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
                  <div className="flex items-center py-2 px-4 gap-2">
                    <Chip
                      label={username}
                      size="small"
                      color="primary"
                      variant="tonal"
                      className="self-start rounded-sm"
                    />
                  </div>
                  <Divider className="my-1" />
                  {/* Shutdown Button */}
                  <MenuItem className="gap-3">
                    <Button
                      onClick={handleShutdown}
                      fullWidth
                      color="primary"
                      variant="outlined"
                      size="small"
                      endIcon={<i className="ri-shut-down-line" />}
                    >
                      Shutdown
                    </Button>
                  </MenuItem>
                  {/* Reboot Button */}
                  <MenuItem className="gap-3">
                  <Button
                      onClick={handleReboot}
                      color="primary"
                      fullWidth
                      variant="text"
                      size="small"
                      endIcon={<i className="ri-restart-line" />}
                    >
                      Reboot
                    </Button>
                  </MenuItem>
                  {/* LogOut Button */}
                  <MenuItem className="gap-3">
                    <Button
                      onClick={handleUserLogout}
                      fullWidth
                      variant="text"
                      size="small"
                      endIcon={<i className="ri-logout-box-r-line" />}
                    >
                      Logout
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
