const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { executeCommand } = require('./executer.cjs');
const wgManager = require('./wgManager.cjs');
const WG_CONFIG_DIR = '/etc/wireguard';
const server = express.Router();
const QRCode = require('qrcode');

// API endpoint to retrieve interface details including clients
server.get('/interfaces', async (req, res) => {
  try {
    // Call the detectWireguardInterfaces function to get interface details
    const interfaces = await wgManager.detectWireguardInterfaces(req);

    if (!interfaces || interfaces.length === 0) {
      return res.status(404).json({ message: 'No WireGuard interfaces found.' });
    }

    // Prepare the response data
    const interfaceDetails = interfaces.map(iface => ({
      name: iface.name,                  // Interface name
      address: iface.address,            // Interface address
      port: iface.port,                  // Listening port (or 'Unknown')
      peerCount: iface.peerCount,        // Number of peers
      isConnected: iface.isConnected,     // Connection status
      transferData: iface.transferData    // Data Transfers
    }));

    // Send the interface details as a response
    return res.json(interfaceDetails);

  } catch (error) {
    console.error('Error retrieving WireGuard interfaces:', error);
    return res.status(500).json({ error: 'Failed to retrieve WireGuard interfaces.' });
  }
});

// API endpoint to create a WireGuard interface
server.post('/create', async (req, res) => {
  const { serverName, port, CIDR, peers, nic } = req.body;

  // Step 1: Validate input
  if (!serverName || !port || !CIDR || !peers || peers <= 0 || !nic) {
    return res.status(400).json({ error: 'Must fill out all fields.' });
  }
  console.log('Received values:', serverName, port, CIDR, peers, nic);

  let availableIps;
  let configContent = "";

  try {
    // Check if IP addresses are available within the given CIDR
    try {
      availableIps = wgManager.getAvailableIPAddresses(CIDR, peers + 1); // +1 for the server itself
      if (availableIps.length < peers + 1) {
        return res.status(400).json({ error: 'Not enough available IP addresses in the given CIDR.' });
      }
    } catch (error) {
      console.error('Error finding available IP addresses:', error.message);
      return res.status(400).json({ error: error.message });
    }

    // Check if the specified port is available
    const portInUse = await wgManager.detectUdpPortInUse(port);
    if (portInUse) {
      return res.status(400).json({ error: 'The specified port is already in use.' });
    }

    // Check if the interface already exists
    try {
      const interfaces = await wgManager.detectWireguardInterfaces(req);
      const interfaceExists = interfaces.some(iface => iface.name === serverName);

      if (interfaceExists) {
        console.log(`WireGuard interface ${serverName} already exists.`);
        return res.status(400).json({ error: `WireGuard interface ${serverName} already exists.` });
      }
    } catch (error) {
      console.error('Error detecting existing interfaces:', error.message);
      return res.status(500).json({ error: `Failed to detect existing interfaces: ${error.message}` });
    }

    // Get global IP
    const endPoint = await wgManager.detectPublicIP();

    // Generate keys for the server
    const serverKeys = await wgManager.generateKeys();

    // Create the server configuration
    configContent = `
[Interface]
Address = ${availableIps[0]}
ListenPort = ${port}
PrivateKey = ${serverKeys.privateKey}
PostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -t nat -A POSTROUTING -o ${nic}+ -j MASQUERADE
PostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -t nat -D POSTROUTING -o ${nic}+ -j MASQUERADE
`;

    // Ensure the server directory exists
    const serverDirPath = path.join(WG_CONFIG_DIR, serverName);
    await fs.mkdir(serverDirPath, { recursive: true });

    // Add peer configurations to the server configuration
    for (let i = 0; i < peers; i++) {
      const peerKeys = await wgManager.generateKeys();
      configContent += `
[Peer]
PublicKey = ${peerKeys.publicKey}
PresharedKey = ${peerKeys.preSharedKey}
AllowedIPs = ${availableIps[i + 1]}/32
`;

      // Create peer configuration
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

      // Write each peer configuration to a separate file
      const peerConfigPath = path.join(serverDirPath, `peer${i + 1}.conf`);
      await fs.writeFile(peerConfigPath, peerConfigContent);
      console.log(`Peer configuration file peer${i + 1}.conf written successfully.`);

      // Generate QR code for the peer configuration
      const qrCodePath = path.join(serverDirPath, `peer${i + 1}.png`);
      await QRCode.toFile(qrCodePath, peerConfigContent);
      console.log(`QR code for peer${i + 1} written successfully.`);
    }

    // Write the server configuration to a file
    const filePath = path.join(WG_CONFIG_DIR, `${serverName}.conf`);
    configContent = configContent.trim();
    await fs.writeFile(filePath, configContent);
    console.log(`Configuration file for ${serverName} written successfully.`);

    // Bring up the WireGuard interface using the configuration
    await executeCommand(`wg-quick up ${filePath}`);
    console.log(`WireGuard interface ${serverName} is up and running.`);

    // Success response
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

  const configFilePath = path.join(WG_CONFIG_DIR, `${name}.conf`);
  const clientFolderPath = path.join(WG_CONFIG_DIR, name); // Path to client (peer) configuration folder

  try {
    // Check if the configuration file exists
    await fs.access(configFilePath);

    // Attempt to bring down the WireGuard interface
    try {
      await executeCommand(`wg-quick down ${configFilePath}`);
      console.log(`WireGuard interface ${name} brought down successfully.`);
    } catch (err) {
      // If bringing the interface down fails, log the error but continue
      if (err.message.includes('is not a WireGuard interface')) {
        console.log(`WireGuard interface ${name} is not active, proceeding with deletion.`);
      } else {
        console.error(`Error while bringing down WireGuard interface ${name}:`, err.message);
        return res.status(500).json({ error: `Failed to bring down WireGuard interface ${name}.` });
      }
    }

    // Delete the client (peer) configuration folder
    try {
      // Check if the client folder exists
      await fs.access(clientFolderPath);
      await fs.rmdir(clientFolderPath, { recursive: true }); // Remove the folder and its contents
      console.log(`Client configuration folder ${clientFolderPath} deleted.`);
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.log(`Client configuration folder ${clientFolderPath} does not exist, skipping.`);
      } else {
        console.warn(`Could not delete client configuration folder for ${name}:`, err.message);
        return res.status(500).json({ error: `Failed to delete client configuration folder for interface ${name}.` });
      }
    }

    // Delete the configuration file
    try {
      await fs.unlink(configFilePath);
      console.log(`Configuration file ${configFilePath} deleted.`);
      return res.status(200).json({ message: `WireGuard interface ${name} deleted successfully.` });
    } catch (err) {
      console.warn(`Could not delete config file for ${name}:`, err.message);
      return res.status(500).json({ error: `Failed to delete configuration file for interface ${name}.` });
    }
  } catch (e) {
    // If the configuration file does not exist, return a 404
    if (e.code === 'ENOENT') {
      console.error(`Configuration file ${configFilePath} does not exist.`);
      return res.status(404).json({ error: `Configuration file for interface ${name} does not exist.` });
    }
    console.error(`Error accessing configuration file ${configFilePath}:`, e.message);
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

  const configFilePath = path.join(WG_CONFIG_DIR, `${name}.conf`);

  try {
    // Check if the config file exists
    await fs.access(configFilePath);

    // Retrieve the current status of all interfaces
    const interfaces = await wgManager.detectWireguardInterfaces(req);
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

// API endpoint to retrieve available network interfaces
server.get('/nics', async (req, res) => {
  try {
    const hardwareInfo = await wgManager.getHardwareInfo(req);
    const nicList = Object.keys(hardwareInfo);
    return res.json(nicList);
  } catch (error) {
    console.error('Error retrieving network interfaces:', error);
    return res.status(500).json({ error: 'Failed to retrieve network interfaces' });
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
      directoryMessage = await wgManager.makeSureDirExists(WG_CONFIG_DIR);
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

// API endpoint to get peers
server.get('/interface/:id/peers', async (req, res) => {
  const { id: interfaceName } = req.params;

  try {
    // Fetch peers for the specified interface
    const peers = await wgManager.getPeersForInterface(interfaceName);

    // If no peers are found
    if (!peers.length) {
      return res.status(404).json({ message: `No peers found for interface ${interfaceName}` });
    }

    // Return the peers as a response
    return res.json(peers);
  } catch (error) {
    console.error(`Error retrieving peers for interface ${interfaceName}:`, error);
    return res.status(500).json({ error: `Failed to retrieve peers for interface ${interfaceName}` });
  }
});
module.exports = server;
