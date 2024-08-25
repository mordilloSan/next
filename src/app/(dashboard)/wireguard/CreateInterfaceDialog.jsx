import React from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Box, Alert } from "@mui/material";

const CreateInterfaceDialog = ({ open, onClose, onCreate, loading, error, name, setName, port, setPort }) => {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Create New Interface</DialogTitle>
      <DialogContent>
        <Box mt={2}>
          <TextField
            label="Interface Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            margin="normal"
          />
          <TextField
            label="Port"
            type="number"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            fullWidth
            margin="normal"
          />
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="secondary">
          Cancel
        </Button>
        <Button onClick={onCreate} color="primary" disabled={!name || !port || loading}>
          {loading ? "Creating..." : "Create Interface"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateInterfaceDialog;
