const express = require('express');
const fs = require('fs'); // Import the regular fs for existsSync
const fsPromises = require('fs').promises; // Import fs.promises for async operations
const path = require('path');
const { executeCommand } = require('./executer.cjs');
const wgManager = require('./wgManager.cjs');
const config = require('./config.cjs');
const server = express.Router();
const QRCode = require('qrcode');

// API endpoint to retrieve interface details including clients
server.get('/interfaces', async (req, res) => {
  try {
    const interfaces = await wgManager.detectWireguardInterfaces();

    if (!interfaces || interfaces.length === 0) {
      return res.status(404).json({ message: 'No WireGuard interfaces found.' });
    }

    const interfaceDetails = interfaces.map(iface => ({
      name: iface.name,
      address: iface.address,
      port: iface.port,
      peerCount: iface.peerCount,
      isConnected: iface.isConnected,
      peerData: iface.peerData
    }));

    return res.json(interfaceDetails);
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
  console.log('Received values:', serverName, port, CIDR, peers, nic);

  let availableIps;
  let configContent = "";

  try {
    availableIps = wgManager.getAvailableIPAddresses(CIDR, peers + 1); // +1 for the server itself
    if (availableIps.length < peers + 1) {
      return res.status(400).json({ error: 'Not enough available IP addresses in the given CIDR.' });
    }

    const portInUse = await wgManager.detectUdpPortInUse(port);
    if (portInUse) {
      return res.status(400).json({ error: 'The specified port is already in use.' });
    }

    const interfaces = await wgManager.detectWireguardInterfaces();
    const interfaceExists = interfaces.some(iface => iface.name === serverName);

    if (interfaceExists) {
      console.log(`WireGuard interface ${serverName} already exists.`);
      return res.status(400).json({ error: `WireGuard interface ${serverName} already exists.` });
    }

    const endPoint = await wgManager.detectPublicIP();
    const serverKeys = await wgManager.generateKeys();

    configContent = `
[Interface]
Address = ${availableIps[0]}
ListenPort = ${port}
PrivateKey = ${serverKeys.privateKey}
PostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -t nat -A POSTROUTING -o ${nic} -j MASQUERADE
PostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -t nat -D POSTROUTING -o ${nic} -j MASQUERADE
`;

    const serverDirPath = path.join(config.WG_CONFIG_DIR, serverName);
    await fsPromises.mkdir(serverDirPath, { recursive: true });

    for (let i = 0; i < peers; i++) {
      const peerKeys = await wgManager.generateKeys();
      configContent += `
[Peer]
PublicKey = ${peerKeys.publicKey}
PresharedKey = ${peerKeys.preSharedKey}
AllowedIPs = ${availableIps[i + 1]}/32
`;

      const peerConfigContent = `
[Interface]
Address = ${availableIps[i + 1]}/32
PrivateKey = ${peerKeys.privateKey}
ListenPort = ${port}

[Peer]
PublicKey = ${serverKeys.publicKey}
PresharedKey = ${peerKeys.preSharedKey}
AllowedIPs = 0.0.0.0/0, ::/0
Endpoint = ${endPoint}:${port}
PersistentKeepalive = 25
`.trim();

      const peerConfigPath = path.join(serverDirPath, `peer${i + 1}.conf`);
      await fsPromises.writeFile(peerConfigPath, peerConfigContent);

      const qrCodePath = path.join(serverDirPath, `peer${i + 1}.png`);
      await QRCode.toFile(qrCodePath, peerConfigContent);
    }

    const filePath = path.join(config.WG_CONFIG_DIR, `${serverName}.conf`);
    await fsPromises.writeFile(filePath, configContent.trim());

    await executeCommand(`wg-quick up ${filePath}`);

    return res.status(201).json({ message: `WireGuard interface ${serverName} created and running successfully.` });

  } catch (error) {
    console.error('Error creating WireGuard interface:', error);
    return res.status(500).json({ error: 'Failed to create WireGuard interface.' });
  }
});

// API endpoint to delete a WireGuard interface
server.delete('/delete/:name', async (req, res) => {
  const { name } = req.params;

  if (!name) {
    return res.status(400).json({ error: 'Interface name is required.' });
  }

  const configFilePath = path.join(config.WG_CONFIG_DIR, `${name}.conf`);
  const clientFolderPath = path.join(config.WG_CONFIG_DIR, name);

  try {
    await fsPromises.access(configFilePath);

    try {
      await executeCommand(`wg-quick down ${configFilePath}`);
    } catch (err) {
      if (!err.message.includes('is not a WireGuard interface')) {
        return res.status(500).json({ error: `Failed to bring down WireGuard interface ${name}.` });
      }
    }

    try {
      await fsPromises.access(clientFolderPath);
      await fsPromises.rm(clientFolderPath, { recursive: true });
    } catch (err) {
      if (err.code !== 'ENOENT') {
        return res.status(500).json({ error: `Failed to delete client configuration folder for interface ${name}.` });
      }
    }

    await fsPromises.unlink(configFilePath);
    return res.status(200).json({ message: `WireGuard interface ${name} deleted successfully.` });

  } catch (e) {
    if (e.code === 'ENOENT') {
      return res.status(404).json({ error: `Configuration file for interface ${name} does not exist.` });
    }
    return res.status(500).json({ error: `Failed to access configuration file for interface ${name}.` });
  }
});

// API endpoint to start/stop a WireGuard interface
server.post('/toggle/:name', async (req, res) => {
  const { name } = req.params;
  const { status } = req.body;

  // Validate input
  if (!name || !status) {
    return res.status(400).json({ error: 'Interface name and status are required.' });
  }

  if (status !== 'up' && status !== 'down') {
    return res.status(400).json({ error: 'Status must be either "up" or "down".' });
  }

  const configFilePath = path.join(config.WG_CONFIG_DIR, `${name}.conf`);

  try {
    // Check if the config file exists
    await fsPromises.access(configFilePath);

    // Retrieve the current status of all interfaces
    const interfaces = await wgManager.detectWireguardInterfaces();
    const interfaceDetails = interfaces.find(iface => iface.name === name);

    if (!interfaceDetails) {
      return res.status(404).json({ error: `Interface ${name} not found.` });
    }

    const currentStatus = interfaceDetails.isConnected === 'Active' ? 'up' : 'down';

    // Compare requested status with current status
    if (currentStatus === status) {
      console.log(`WireGuard interface ${name} is already ${status}. No change needed.`);
      return res.json({ message: `WireGuard interface ${name} is already ${status}.` });
    }

    // Toggle the WireGuard interface and log the change
    if (status === 'up') {
      await executeCommand(`wg-quick up ${configFilePath}`);
      console.log(`WireGuard interface ${name} was down and is now up.`);
      return res.json({ message: `WireGuard interface ${name} is now up.` });
    } else if (status === 'down') {
      await executeCommand(`wg-quick down ${configFilePath}`);
      console.log(`WireGuard interface ${name} was up and is now down.`);
      return res.json({ message: `WireGuard interface ${name} is now down.` });
    }
  } catch (error) {
    // Handle errors
    if (error.code === 'ENOENT') {
      console.error(`Configuration file ${configFilePath} does not exist.`);
      return res.status(404).json({ error: `Configuration file for interface ${name} does not exist.` });
    }
    // Check for specific error messages
    if (error.message.includes('Address already in use')) {
      console.error(`Error toggling WireGuard interface ${name}: Address already in use.`);
      return res.status(400).json({ error: 'The IP address is already in use. Please check the configuration.' });
    }
    console.error(`Error toggling WireGuard interface ${name}:`, error);
    return res.status(500).json({ error: `Failed to ${status} WireGuard interface ${name}.` });
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
      errorCode = "DIR_NOT_FOUND"; // Directory not found error code
      directoryMessage = dirError.message;
    }
  } catch (error) {
    errorCode = "WIREGUARD_INSTALL_FAILED"; // WireGuard installation failed error code
    console.error('Error:', error.message); // Log the error message
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

    if (!fs.existsSync(configPath)) {
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
    // Define the path to the QR code file (adjust the path based on your setup)
    const qrCodePath = path.join(config.WG_CONFIG_DIR, interfaceName, `${peerName}.png`);

    // Check if the QR code file exists
    if (!fs.existsSync(qrCodePath)) {
      return res.status(404).json({ error: 'QR code file not found' });
    }

    // Read the QR code image as a binary buffer
    const qrCodeImage = await fs.promises.readFile(qrCodePath);

    // Convert the binary buffer to a base64-encoded string
    const base64QRCode = `data:image/png;base64,${qrCodeImage.toString('base64')}`;

    // Send the base64-encoded image as JSON
    return res.json({ qrcode: base64QRCode });
  } catch (error) {
    console.error(`Error processing QR code request for peer ${peerName}:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


module.exports = server;
