// server.js

const express = require('express');
const path = require('path');
const wgManager = require('./wgManager.cjs');
const config = require('./config.cjs');
const server = express.Router();
const { existsSync } = require('fs');

// Middleware to parse JSON bodies
server.use(express.json());

// API endpoint to retrieve interface details including clients
server.get('/interfaces', async (req, res) => {
  try {
    const interfaces = await wgManager.detectWireguardInterfaces();

    if (!interfaces || interfaces.length === 0) {
      return res.status(404).json({ message: 'No WireGuard interfaces found.' });
    }

    return res.json(interfaces);
  } catch (error) {
    console.error('Error retrieving WireGuard interfaces:', error);
    return res.status(500).json({ error: 'Failed to retrieve WireGuard interfaces.' });
  }
});

// API endpoint to create a WireGuard interface
server.post('/create', async (req, res) => {
  const { serverName, port, CIDR, peers, nic } = req.body;

  if (!serverName || !port || !CIDR || !peers || peers <= 0 || !nic) {
    return res.status(400).json({ error: 'Must fill out all fields.' });
  }

  try {
    const result = await wgManager.createInterface(serverName, port, CIDR, peers, nic);
    return res.status(201).json(result);
  } catch (error) {
    console.error('Error creating WireGuard interface:', error);
    return res.status(500).json({ error: error.message });
  }
});

// API endpoint to delete a WireGuard interface
server.delete('/delete/:name', async (req, res) => {
  const { name } = req.params;

  if (!name) {
    return res.status(400).json({ error: 'Interface name is required.' });
  }

  try {
    const result = await wgManager.deleteInterface(name);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error deleting WireGuard interface:', error);
    return res.status(500).json({ error: error.message });
  }
});

// API endpoint to start/stop a WireGuard interface
server.post('/toggle/:name', async (req, res) => {
  const { name } = req.params;
  const { status } = req.body;

  if (!name || !status) {
    return res.status(400).json({ error: 'Interface name and status are required.' });
  }

  if (status !== 'up' && status !== 'down') {
    return res.status(400).json({ error: 'Status must be either "up" or "down".' });
  }

  try {
    const result = await wgManager.toggleInterface(name, status);
    return res.json(result);
  } catch (error) {
    console.error(`Error toggling WireGuard interface ${name}:`, error);
    return res.status(500).json({ error: error.message });
  }
});

// API endpoint to check if WireGuard is installed
server.get('/check', async (req, res) => {
  let installedStatus = "not ok";
  let directoryStatus = "not ok";
  let directoryMessage = "";
  let errorCode = null;
  let wgVersion = "";

  try {
    // Check if WireGuard is installed
    wgVersion = await wgManager.ensureWireGuardInstalled();
    installedStatus = "ok";

    try {
      // Ensure the WireGuard directory exists
      directoryMessage = await wgManager.makeSureDirExists(config.WG_CONFIG_DIR);
      directoryStatus = "ok";
    } catch (dirError) {
      directoryStatus = "not ok";
      errorCode = "DIR_NOT_FOUND";
      directoryMessage = dirError.message;
    }
  } catch (error) {
    errorCode = "WIREGUARD_INSTALL_FAILED";
    console.error('Error:', error.message);
  }

  res.json({
    installed: installedStatus,
    wgVersion: wgVersion || "Not available",
    directory: directoryStatus,
    directoryMessage: directoryMessage,
    errorCode: errorCode
  });
});

// API endpoint to download peer conf file
server.get('/:interfaceName/:peerName/config', async (req, res) => {
  const { peerName, interfaceName } = req.params;

  try {
    const configPath = path.join(config.WG_CONFIG_DIR, interfaceName, `${peerName}.conf`);

    if (!existsSync(configPath)) {
      return res.status(404).json({ error: 'Peer configuration file not found' });
    }

    res.download(configPath, `${peerName}.conf`, (err) => {
      if (err) {
        console.error(`Error sending config file for peer ${peerName}:`, err);
        res.status(500).json({ error: 'Failed to download config file' });
      }
    });
  } catch (error) {
    console.error(`Error processing download request for peer ${peerName}:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint to download peer QR code
server.get('/:interfaceName/:peerName/qrcode', async (req, res) => {
  const { peerName, interfaceName } = req.params;

  try {
    const qrCode = await wgManager.getClientQRCode(interfaceName, peerName);
    return res.json({ qrcode: qrCode });
  } catch (error) {
    console.error(`Error processing QR code request for peer ${peerName}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to delete a WireGuard peer
server.delete('/:interfaceName/:peerName/remove', async (req, res) => {
  const { interfaceName, peerName } = req.params;

  try {
    const result = await wgManager.deleteClient(interfaceName, peerName);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error removing peer:', error);
    return res.status(500).json({ error: error.message });
  }
});

// API endpoint to add a WireGuard peer
server.post('/:interfaceName/:peerName/add', async (req, res) => {
  const { interfaceName, peerName } = req.params;

  try {
    const result = await wgManager.createClient(interfaceName);
    return res.status(201).json(result);
  } catch (error) {
    console.error('Error adding peer:', error);
    return res.status(500).json({ error: error.message });
  }
});

// API endpoint to get clients for an interface
server.get('/:interfaceName/clients', async (req, res) => {
  const { interfaceName } = req.params;

  try {
    const clients = await wgManager.getClients(interfaceName);
    return res.json(clients);
  } catch (error) {
    console.error('Error getting clients:', error);
    return res.status(500).json({ error: error.message });
  }
});

// API endpoint to get metrics
server.get('/metrics', async (req, res) => {
  try {
    const metrics = await wgManager.getMetrics();
    return res.json(metrics);
  } catch (error) {
    console.error('Error getting metrics:', error);
    return res.status(500).json({ error: 'Failed to retrieve metrics.' });
  }
});

module.exports = server;
