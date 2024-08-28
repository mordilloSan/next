// Customizer.js

"use client";

import React, { useState } from "react";
import {  Dialog,  DialogTitle,  DialogContent,  DialogActions,  Button,} from "@mui/material";
import classnames from "classnames";
import { useDebounce } from "react-use";
import { HexColorPicker, HexColorInput } from "react-colorful";
import primaryColorConfig from "@configs/primaryColorConfig";
import { useSettings } from "@/hooks/useSettings";
import styles from "./styles.module.css";

const DebouncedColorPicker = ({ settings, handleChange }) => {
  const [debouncedColor, setDebouncedColor] = useState(
    settings.primaryColor ?? primaryColorConfig[0].main,
  );

  useDebounce(() => handleChange("primaryColor", debouncedColor), 200, [
    debouncedColor,
  ]);

  return (
    <div className={styles.colorPickerWrapper}>
      <HexColorPicker
        color={debouncedColor}
        onChange={setDebouncedColor}
        className={styles.colorPicker}
      />
      <HexColorInput
        className={styles.colorInput}
        color={debouncedColor}
        onChange={setDebouncedColor}
        prefixed
        placeholder="Type a color"
      />
    </div>
  );
};

const Customizer = ({ open, onClose }) => {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const { settings, updateSettings } = useSettings();
  const isColorFromPrimaryConfig = primaryColorConfig.find(
    (item) => item.main === settings.primaryColor,
  );

  const handleChange = (field, value) => {
    updateSettings({ [field]: value });
  };

  const togglePicker = () => {
    setIsPickerOpen((prev) => !prev);
  };

  const handleClose = () => {
    setIsPickerOpen(false); // Reset the color picker visibility
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        style: {
          overflow: "visible",
        },
      }}
    >
      <DialogTitle>Customize Primary Color</DialogTitle>
      <DialogContent dividers>
        <div className={styles.customizerBody}>
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              {primaryColorConfig.map((item) => (
                <div
                  key={item.main}
                  className={classnames(styles.primaryColorWrapper, {
                    [styles.active]: settings.primaryColor === item.main,
                  })}
                  onClick={() => handleChange("primaryColor", item.main)}
                >
                  <div
                    className={styles.primaryColor}
                    style={{ backgroundColor: item.main }}
                  />
                </div>
              ))}
              <div
                className={classnames(styles.primaryColorWrapper, {
                  [styles.active]: !isColorFromPrimaryConfig,
                })}
                onClick={togglePicker}
              >
                <div
                  className={classnames(
                    styles.primaryColor,
                    "flex items-center justify-center",
                  )}
                  style={{
                    backgroundColor: !isColorFromPrimaryConfig
                      ? settings.primaryColor
                      : "var(--mui-palette-action-selected)",
                    color: isColorFromPrimaryConfig
                      ? "var(--mui-palette-text-primary)"
                      : "var(--mui-palette-primary-contrastText)",
                  }}
                >
                  <i className="ri-palette-line text-xl" />
                </div>
              </div>
            </div>
            {isPickerOpen && (
              <div className="mt-4">
                <DebouncedColorPicker
                  settings={settings}
                  isColorFromPrimaryConfig={isColorFromPrimaryConfig}
                  handleChange={handleChange}
                />
              </div>
            )}
          </div>
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default Customizer;
