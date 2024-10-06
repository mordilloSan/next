"use client";

import { useRef, useState } from "react";
import { Popper, Fade, Paper, ClickAwayListener, MenuList, MenuItem, Chip, Divider } from "@mui/material";
import { useSettings } from "@/hooks/useSettings";
import Customizer from "@/components/customizer";
import { Icon } from "@iconify/react";
import NavbarButton from "./NavbarButton";

const SettingsDropdown = () => {
  const anchorRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
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
      <div ref={anchorRef} onClick={handleDropdownOpen} className="cursor-pointer"      >
        <Icon icon="ri:settings-4-line" width="22px" height="22px" />
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
            style={{ transformOrigin: placement === "bottom-end" ? "right top" : "left top", }}
          >
            <Paper className="shadow-lg">
              <ClickAwayListener onClickAway={handleDropdownClose}>
                <MenuList>
                  <div className="py-2 px-4">
                    <Chip
                      label="Global Settings"
                      color="primary"
                      variant="tonal"
                      className="rounded-sm w-full"
                    />
                  </div>
                  <Divider className="my-1" />
                  <MenuItem onClick={handleModeSwitch} >
                    <NavbarButton
                      icon={<i className={getModeIcon()} />}
                      text={getModeText()}
                    />
                  </MenuItem>
                  {settings.mode === "dark" || (
                    <MenuItem onClick={handleSemiDarkToggle} >
                      <NavbarButton
                        icon={<i className={`${settings.semiDark ? "ri-sun-cloudy-line" : "ri-cloud-line"}`} />}
                        text="Semi Dark"
                      />
                    </MenuItem>
                  )}
                  <MenuItem onClick={handleOpenCustomizer}>
                    <NavbarButton
                      icon={<i className="ri-palette-line" />}
                      text="Color Settings"
                    />
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
