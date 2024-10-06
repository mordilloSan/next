"use client";

import { useRef, useState } from "react";
import { Popper, Fade, Paper, ClickAwayListener, MenuList, Typography, MenuItem } from "@mui/material";
import { useSettings } from "@/hooks/useSettings";
import Customizer from "@/components/customizer";
import { Icon } from "@iconify/react";

const SettingsDropdown = () => {
  const [open, setOpen] = useState(false);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const anchorRef = useRef(null);
  const { settings, updateSettings } = useSettings();

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
      <div
        ref={anchorRef}
        onClick={handleDropdownOpen}
        className="cursor-pointer"
      >
        <Icon icon="ri:settings-4-line" width="22px" height="22px" />
      </div>
      <Popper
        open={open}
        transition
        disablePortal
        placement="bottom-end"
        anchorEl={anchorRef.current}
        className="min-w-[200px] mb-4 z-10"
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
                  <MenuItem className="gap-3" onClick={handleModeSwitch}>
                    <i className={getModeIcon()} />
                    <Typography color="text.primary">
                      {getModeText()}
                    </Typography>
                  </MenuItem>
                  {settings.mode === "dark" || (
                    <MenuItem className="gap-3" onClick={handleSemiDarkToggle}>
                      <i
                        className={`${settings.semiDark ? "ri-sun-cloudy-line" : "ri-cloud-line"}`}
                      />
                      <Typography color="text.primary">Semi Dark</Typography>
                    </MenuItem>
                  )}
                  <MenuItem className="gap-3" onClick={handleOpenCustomizer}>
                    <i className="ri-palette-line" />
                    <Typography color="text.primary">Settings</Typography>
                  </MenuItem>
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
