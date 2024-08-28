"use client";

import { useRef, useState, useEffect } from "react";
import { Chip, Popper, Fade, Paper, ClickAwayListener, MenuList, Typography, Divider, MenuItem, Button, } from "@mui/material";
import { useSettings } from "@/hooks/useSettings";
import { useAuth } from "@/contexts/AuthContext";
import Customizer from "@/components/customizer";

const SettingsDropdown = () => {
  const [open, setOpen] = useState(false);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [username, setUsername] = useState("");
  const anchorRef = useRef(null);
  const { logout } = useAuth();

  // Hooks
  const { settings, updateSettings } = useSettings();

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

  // Update Settings
  const handleChange = (field, value) => {
    updateSettings({ [field]: value });
  };

  const handleDropdownOpen = () => {
    setOpen((prev) => !prev);
  };

  const handleDropdownClose = (event) => {
    if (anchorRef.current && anchorRef.current.contains(event.target)) {
      return;
    }
    setOpen(false);
  };

  const handleOpenCustomizer = () => {
    setIsCustomizerOpen(true);
  };

  const handleCloseCustomizer = () => {
    setIsCustomizerOpen(false);
  };

  const handleUserLogout = () => {
    logout();
  };

  const handleModeSwitch = () => {
    updateSettings({ mode: settings.mode === "dark" ? "light" : "dark" });
  };

  const handleSemiDarkToggle = () => {
    handleChange("semiDark", !settings.semiDark);
  };

  const getModeIcon = () => {
    return settings.mode === "dark" ? "ri-moon-clear-line" : "ri-sun-line";
  };

  const getModeText = () => {
    return settings.mode === "dark" ? "Dark mode" : "Light mode";
  };

  return (
    <>
      <div ref={anchorRef} onClick={handleDropdownOpen} className="cursor-pointer">
        <i className="ri-settings-4-line" />
      </div>
      <Popper open={open} transition disablePortal placement="bottom-end" anchorEl={anchorRef.current} className="min-w-[200px] mb-4 z-10">
        {({ TransitionProps, placement }) => (
          <Fade
            {...TransitionProps}
            style={{ transformOrigin: placement === "bottom-end" ? "right top" : "left top", }}>
            <Paper className="shadow-lg">
              <ClickAwayListener onClickAway={handleDropdownClose}>
                <MenuList>
                  <div className="flex items-center py-2 px-4 gap-2">
                    <Chip label={username} size="small" color="primary" variant="tonal" className="self-start rounded-sm" />
                  </div>
                  <Divider className="my-1" />
                  <MenuItem className="gap-3" onClick={handleModeSwitch}>
                    <i className={getModeIcon()} />
                    <Typography color="text.primary">
                      {getModeText()}
                    </Typography>
                  </MenuItem>
                  {settings.mode === "dark" || (
                    <MenuItem className="gap-3" onClick={handleSemiDarkToggle}>
                      <i className={`${settings.semiDark ? "ri-sun-cloudy-line" : "ri-cloud-line"}`} />
                      <Typography color="text.primary">Semi Dark</Typography>
                    </MenuItem>
                  )}
                  <MenuItem className="gap-3" onClick={handleOpenCustomizer}>
                    <i className="ri-palette-line" />
                    <Typography color="text.primary">Settings</Typography>
                  </MenuItem>
                  <div className="flex items-center py-2 px-4">
                    <Button fullWidth variant="contained" color="error" size="small"
                      endIcon={<i className="ri-logout-box-r-line" />}
                      onClick={handleUserLogout}
                    >
                      Logout
                    </Button>
                  </div>
                </MenuList>
              </ClickAwayListener>
            </Paper>
          </Fade>
        )}
      </Popper>

      <Customizer open={isCustomizerOpen} onClose={handleCloseCustomizer} />
    </>
  );
};

export default SettingsDropdown;
