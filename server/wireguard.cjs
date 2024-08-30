const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { executeCommand } = require('./executer.cjs');
const wgManager = require('./wgManager.cjs');
const WG_CONFIG_DIR = '/etc/wireguard';
const server = express.Router();

// API endpoint to retrieve interface details including clients
server.get('/interfaces', async (req, res) => {
    try {
        const interfaces = await wgManager.detectWireguardInterfaces(req);
        const interfaceDetails = [];

        for (const iface of interfaces) {
            const { name, status } = iface;
            const filePath = path.join(WG_CONFIG_DIR, `${name}.conf`);

            let configContent = '';
            try {
                configContent = await fs.readFile(filePath, 'utf-8');
            } catch (err) {
                console.warn(`Could not read config file for ${name}:`, err.message);
            }

            const clients = [];
            const lines = configContent.split('\n');
            let currentClient = null;

            lines.forEach(line => {
                line = line.trim();
                if (line.startsWith('[Peer]')) {
                    if (currentClient) {
                        clients.push(currentClient);
                    }
                    currentClient = { publicKey: '', allowedIPs: '' };
                } else if (currentClient && line.includes('PublicKey = ')) {
                    currentClient.publicKey = line.split(' = ')[1];
                } else if (currentClient && line.includes('AllowedIPs = ')) {
                    currentClient.allowedIPs = line.split(' = ')[1];
                }
            });

            if (currentClient) {
                clients.push(currentClient);
            }

            interfaceDetails.push({
                name,
                status,
                clients,
            });
        }

        return res.json(interfaceDetails);
    } catch (error) {
        console.error('Error retrieving interface details:', error);
        return res.status(500).json({ error: 'Failed to retrieve interface details' });
    }
});

// API endpoint to create a WireGuard interface
server.post('/create', async (req, res) => {
    const { serverName, port, CIDR, peers } = req.body;

    // Step 1: Validate input
    if (!serverName || !port || !CIDR || !peers || peers.length === 0) {
        return res.status(400).json({ error: 'serverName, port, CIDR, and peers are required.' });
    }

    try {
        // Check if IP addresses are available within the given CIDR
        try {
            const availableIps = wgManager.getAvailableIPAddresses(CIDR, peers.length + 1); // +1 for the server itself
            if (availableIps.length < peers.length + 1) {
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
                console.log("WireGuard interface ${serverName} already exists.")
                return res.status(400).json({ error: `WireGuard interface ${serverName} already exists.` });
            }
        } catch (error) {
            console.error('Error detecting existing interfaces:', error.message);
            return res.status(500).json({ error: `Failed to detect existing interfaces: ${error.message}` });
        }
        // Step 4: Get global ip
        const endPoint = await wgManager.detectPublicIP();

        // Step 4: Generate keys for the server
        const serverKeys = await wgManager.generateKeys();

        // Step 5: Create the configuration content
        let configContent = `
[Interface]
Address = ${availableIps[0]}
ListenPort = ${port}
PrivateKey = ${serverKeys.privateKey}
PostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -t nat -A POSTROUTING -o enp+ -j MASQUERADE
PostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -t nat -D POSTROUTING -o enp+ -j MASQUERADE
`;
        // Add peer configurations
        for (let i = 0; i < peers.length; i++) {
            const peerKeys = await wgManager.generateKeys(); // Generate keys for each peer
            configContent += `
[Peer]
PublicKey = ${peerKeys.publicKey}
PresharedKey = ${peerKeys.preSharedKey}
AllowedIPs = ${availableIps[i + 1]}/32
`;
        }

        // Step 6: Write the configuration to a file
        const filePath = path.join(WG_CONFIG_DIR, `${serverName}.conf`);
        await fs.writeFile(filePath, configContent);
        console.log(`Configuration file for ${serverName} written successfully.`);

        // Step 7: Bring up the WireGuard interface using the configuration
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
    if (!name) { return res.status(400).json({ error: 'Interface name is required.' }); }
    const configFilePath = path.join(WG_CONFIG_DIR, `${name}.conf`);

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

        const currentStatus = interfaceDetails.status === 'active' ? 'up' : 'down';

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

module.exports = server;
