import React, { useState } from "react";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Button,
  TextField,
  FormControl,
  Grid,
  Switch,
  InputLabel,
  MenuItem,
  Select,
} from "@mui/material";

const IPv4SettingsDialog = ({ open, handleClose, handleSave }) => {
  const [ipAddress, setIpAddress] = useState("192.168.1.66");
  const [prefixLength, setPrefixLength] = useState("24");
  const [gateway, setGateway] = useState("");
  const [dnsServer, setDnsServer] = useState("1.1.1.1");
  const [manualMode, setManualMode] = useState("Manual");

  const handleSaveClick = () => {
    // Save settings logic here
    handleSave({ ipAddress, prefixLength, gateway, dnsServer, manualMode });
    handleClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>IPv4 Settings</DialogTitle>
      <DialogContent>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Mode</InputLabel>
              <Select
                value={manualMode}
                onChange={(e) => setManualMode(e.target.value)}
              >
                <MenuItem value="Manual">Manual</MenuItem>
                <MenuItem value="Automatic">Automatic</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Address"
              fullWidth
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Prefix length or netmask"
              fullWidth
              value={prefixLength}
              onChange={(e) => setPrefixLength(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Gateway"
              fullWidth
              value={gateway}
              onChange={(e) => setGateway(e.target.value)}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="DNS Server"
              fullWidth
              value={dnsServer}
              onChange={(e) => setDnsServer(e.target.value)}
            />
          </Grid>
          <Grid item xs={12}>
            <Switch checked={false} />
            <InputLabel>Automatic DNS</InputLabel>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button onClick={handleSaveClick} variant="contained" color="primary">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default IPv4SettingsDialog;
