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

    if (!interfaces) {
      return res.status(404).json({ message: 'No WireGuard interfaces found.' });
    }

    if (interfaces.length === 0) {
      return res.json({ message: 'No WireGuard interfaces found.' });
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
  let availableIps;
  let configContent = "";

  try {
    // Get available IPs for the server and peers
    availableIps = wgManager.getAvailableIPAddresses(CIDR, peers + 1); // +1 for the server itself
    if (availableIps.length < peers + 1) {
      return res.status(400).json({ error: 'Not enough available IP addresses in the given CIDR.' });
    }

    // Check if the port is available
    const portInUse = await wgManager.detectUdpPortInUse(port);
    if (portInUse) {
      return res.status(400).json({ error: 'The specified port is already in use.' });
    }

    // Check if the interface already exists
    const interfaces = await wgManager.detectWireguardInterfaces();
    const interfaceExists = interfaces.some(iface => iface.name === serverName);

    if (interfaceExists) {
      console.log(`WireGuard interface ${serverName} already exists.`);
      return res.status(400).json({ error: `WireGuard interface ${serverName} already exists.` });
    }

    // Detect the public IP and generate server keys
    const endPoint = await wgManager.detectPublicIP();
    const serverKeys = await wgManager.generateKeys();

    // Build the server configuration
    configContent = `
[Interface]
Address = ${availableIps[0]}
ListenPort = ${port}
PrivateKey = ${serverKeys.privateKey}
PostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -t nat -A POSTROUTING -o ${nic} -j MASQUERADE
PostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -t nat -D POSTROUTING -o ${nic} -j MASQUERADE
`.trim();

    // Ensure the server directory exists
    const serverDirPath = path.join(config.WG_CONFIG_DIR, serverName);
    await fsPromises.mkdir(serverDirPath, { recursive: true });

    // Add peers
    for (let i = 0; i < peers; i++) {
      const { serverConfigContent, peerConfigContent } = await wgManager.addPeer(availableIps[i + 1], endPoint, port, serverKeys.publicKey);
      configContent += `\n${serverConfigContent}`;
      const peerConfigPath = path.join(serverDirPath, `peer${i + 1}.conf`);
      await fsPromises.writeFile(peerConfigPath, peerConfigContent);
      const qrCodePath = path.join(serverDirPath, `peer${i + 1}.png`);
      await QRCode.toFile(qrCodePath, peerConfigContent);
    }

    // Write the server configuration to a file
    const filePath = path.join(config.WG_CONFIG_DIR, `${serverName}.conf`);
    await fsPromises.writeFile(filePath, configContent);

    // Bring up the WireGuard interface
    await executeCommand(`wg-quick up ${filePath}`);

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

// API endpoint to delete a WireGuard peer
server.delete('/:interfaceName/:peerName/remove', async (req, res) => {
  const { interfaceName, peerName } = req.params;

  try {
    // Find the peer's config file (based on the peer name)
    const peerConfigPath = path.join(config.WG_CONFIG_DIR, interfaceName, `${peerName}.conf`);

    // Check if the peer's config file exists
    await fsPromises.access(peerConfigPath);

    // Read the peer config file to get the PresharedKey
    const peerConfigContent = await fsPromises.readFile(peerConfigPath, 'utf8');
    const presharedKeyMatch = peerConfigContent.match(/PresharedKey\s*=\s*([A-Za-z0-9+/=]+)/);

    if (!presharedKeyMatch || !presharedKeyMatch[1]) {
      return res.status(404).json({ error: 'PresharedKey not found in the peer configuration.' });
    }

    const peerPresharedKey = presharedKeyMatch[1];

    // Now, read the main interface config file to find the peer section with the matching PresharedKey
    const configFilePath = path.join(config.WG_CONFIG_DIR, `${interfaceName}.conf`);

    // Check if the configuration file exists
    await fsPromises.access(configFilePath);

    // Read the current configuration file
    let configContent = await fsPromises.readFile(configFilePath, 'utf8');

    // Split config content by lines for easier manipulation
    const configLines = configContent.split('\n');

    // Flags for tracking if we're inside the peer section to remove
    let insidePeerSection = false;
    let startLineIndex = -1;
    let endLineIndex = -1;

    // Search for the peer section with the matching PresharedKey
    for (let index = 0; index < configLines.length; index++) {
      const line = configLines[index];

      if (line.trim().startsWith('[Peer]')) {
        insidePeerSection = true;
        startLineIndex = index;
      }

      if (insidePeerSection && line.includes(`PresharedKey = ${peerPresharedKey}`)) {
        endLineIndex = index;
        for (let i = index + 1; i < configLines.length; i++) {
          if (configLines[i].trim() === '') {
            endLineIndex = i;
            break;
          }
        }
        break;  // Stop further processing once we find the matching peer
      }
    }

    if (startLineIndex === -1 || endLineIndex === -1) {
      return res.status(404).json({ error: 'Peer not found in the interface configuration.' });
    }

    // Remove the peer section
    const updatedConfigLines = configLines.slice(0, startLineIndex).concat(configLines.slice(endLineIndex + 2));
    const updatedConfigContent = updatedConfigLines.join('\n').trim();

    // Write the updated configuration back to the file
    await fsPromises.writeFile(configFilePath, updatedConfigContent);

    // Delete the peer's configuration file and QR code
    const qrCodePath = path.join(config.WG_CONFIG_DIR, interfaceName, `${peerName}.png`);

    try {
      await fsPromises.unlink(peerConfigPath); // Delete the peer config file
      await fsPromises.unlink(qrCodePath);     // Delete the QR code file
    } catch (error) {
      console.warn(`Could not delete peer configuration or QR code files: ${error.message}`);
    }

    wgManager.restartWireGuardInterface(req, interfaceName);

    return res.status(200).json({ message: `Peer with name ${peerName} removed successfully.` });

  } catch (error) {
    console.error('Error removing peer:', error);
    return res.status(500).json({ error: 'Failed to remove peer from the configuration.' });
  }
});

// API endpoint to add a WireGuard peer
server.post('/:interfaceName/:peerName/add', async (req, res) => {
  const { interfaceName } = req.params;

  try {
    // Find the existing interface configuration
    const configFilePath = path.join(config.WG_CONFIG_DIR, `${interfaceName}.conf`);

    // Check if the interface configuration file exists
    await fsPromises.access(configFilePath);

    // Read the current interface configuration content
    const existingConfigContent = await fsPromises.readFile(configFilePath, 'utf8');

    // Extract IP from the Address field in the [Interface] section
    const cidrMatch = existingConfigContent.match(/Address\s*=\s*([0-9.\/]+)/);
    if (!cidrMatch) {
      return res.status(500).json({ error: 'Failed to find CIDR in the interface configuration.' });
    }
    const CIDR = cidrMatch[1]; // Extracted CIDR from the configuration

    // Extract ListenPort from the [Interface] section
    const listenPortMatch = existingConfigContent.match(/ListenPort\s*=\s*([0-9]+)/);
    if (!listenPortMatch) {
      return res.status(500).json({ error: 'Failed to find ListenPort in the interface configuration.' });
    }
    const listenPort = listenPortMatch[1]; // Extracted ListenPort

    // Extract all the existing IP addresses from the config
    const ipMatches = existingConfigContent.match(/AllowedIPs\s*=\s*([0-9.]+)\/[0-9]+/g) || [];

    // Extract the IPs themselves from the matches
    const existingIps = ipMatches.map(match => match.split('=')[1].trim().split('/')[0]);

    if (existingIps.length === 0) {
      return res.status(500).json({ error: 'No existing IP addresses found in the configuration.' });
    }

    // Find the last IP and increment it
    const lastIp = existingIps.sort()[existingIps.length - 1];  // Sort and take the highest
    const newIp = wgManager.incrementIPAddress(lastIp); // Ensure this function works properly

    if (!newIp) {
      return res.status(500).json({ error: 'Failed to calculate a new IP address.' });
    }

    // Detect the public IP and retrieve the existing public key for the server
    const endPoint = await wgManager.detectPublicIP();
    const serverPublicKeyMatch = existingConfigContent.match(/PublicKey\s*=\s*([A-Za-z0-9+/=]+)/);

    if (!serverPublicKeyMatch) {
      return res.status(500).json({ error: 'Failed to find the server PublicKey in the existing configuration.' });
    }

    const serverPublicKey = serverPublicKeyMatch[1];

    // Generate a new peer name by checking the existing peer configuration files
    const peerFiles = await fsPromises.readdir(path.join(config.WG_CONFIG_DIR, interfaceName));
    const peerNumbers = peerFiles
      .filter(file => file.startsWith('peer') && file.endsWith('.conf'))
      .map(file => parseInt(file.match(/peer(\d+)/)[1]))  // Extract the peer number from the filename
      .filter(num => !isNaN(num));  // Filter out any invalid numbers

    const nextPeerNumber = peerNumbers.length > 0 ? Math.max(...peerNumbers) + 1 : 1;
    const peerName = `peer${nextPeerNumber}`;

    // Add a new peer using the `addPeer` function
    const { serverConfigContent, peerConfigContent } = await wgManager.addPeer(newIp, endPoint, listenPort, serverPublicKey);

    // Ensure newlines are added between peers to prevent merging of configurations
    const updatedConfigContent = `${existingConfigContent.trim()}\n\n${serverConfigContent}`.trim();

    // Write the updated server configuration back to the file
    await fsPromises.writeFile(configFilePath, updatedConfigContent);

    // Save the peer's configuration file and QR code
    const peerConfigPath = path.join(config.WG_CONFIG_DIR, interfaceName, `${peerName}.conf`);
    await fsPromises.writeFile(peerConfigPath, peerConfigContent);
    const qrCodePath = path.join(config.WG_CONFIG_DIR, interfaceName, `${peerName}.png`);
    await QRCode.toFile(qrCodePath, peerConfigContent);

    // Restart the interface using the helper function
    wgManager.restartWireGuardInterface(req, interfaceName);

    return res.status(201).json({
      message: `Peer ${peerName} added successfully to ${interfaceName}.`,
      peerInfo: {
        name: peerName,
        ip: newIp,
        configPath: peerConfigPath,
      },
    });

  } catch (error) {
    console.error('Error adding peer:', error);
    return res.status(500).json({ error: 'Failed to add peer to the WireGuard interface.' });
  }
});

module.exports = server;