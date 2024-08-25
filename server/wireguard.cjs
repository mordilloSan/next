const express = require('express');
const fs = require('fs').promises;
const dgram = require('dgram');
const path = require('path');
const { executeSudoCommand } = require('./executer.cjs');
const { generateKeyPair, writeConfig, checkWgIsInstalled, WgConfig , makeSureDirExists, makeSureFileExists} = require('wireguard-tools');
const WG_CONFIG_DIR = '/etc/wireguard';
const server = express.Router();

// Function to check if a UDP port is already used with a timeout
function detectUdpPortInUse(port, timeout = 5000) {
    console.log(`Checking if UDP port ${port} is in use...`);

    return new Promise((resolve, reject) => {
        const udpTester = dgram.createSocket('udp4');
        let timeoutHandle;

        udpTester.once('error', (err) => {
            clearTimeout(timeoutHandle);
            if (err.code === 'EADDRINUSE') {
                console.log(`UDP port ${port} is already in use.`);
                resolve(true);
            } else {
                console.error(`Error checking UDP port ${port}:`, err);
                reject(err);
            }
        });

        udpTester.once('listening', () => {
            console.log(`UDP port ${port} is free.`);
            clearTimeout(timeoutHandle);
            udpTester.close();
            resolve(false);
        });

        udpTester.bind(port);

        timeoutHandle = setTimeout(() => {
            console.log(`Timeout while checking UDP port ${port}.`);
            udpTester.close();
            resolve(false);
        }, timeout);
    });
}

// Function to detect public IP using an asynchronous call
async function detectPublicIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        console.error('Error detecting public IP:', error);
        throw new Error('Failed to detect public IP.');
    }
}

// Helper function to check if WireGuard is installed
async function ensureWireGuardInstalled() {
    try {
        await checkWgIsInstalled();
        console.log('WireGuard is installed.');
    } catch (error) {
        console.error('WireGuard is not installed:', error);
        throw new Error('WireGuard is not installed on this server.');
    }
}

// Function to detect possible WireGuard interfaces
async function detectWireguardInterfaces() {
    try {
        const stdout = await executeSudoCommand('wg show');
        const activeInterfaces = stdout
            .split('\n')
            .map(line => line.match(/^interface: (\w+)/))
            .filter(match => match)
            .map(match => match[1]);

        await fs.mkdir(WG_CONFIG_DIR, { recursive: true });
        const files = await fs.readdir(WG_CONFIG_DIR);
        const configInterfaces = files
            .filter(file => file.endsWith('.conf'))
            .map(file => file.replace('.conf', ''));

        const interfaceStatus = configInterfaces.map(configInterface => ({
            name: configInterface,
            status: activeInterfaces.includes(configInterface) ? 'active' : 'inactive',
        }));

        const activeWithoutConfig = activeInterfaces
            .filter(activeInterface => !configInterfaces.includes(activeInterface))
            .map(activeInterface => ({
                name: activeInterface,
                status: 'active (no config file)',
            }));

        return [...interfaceStatus, ...activeWithoutConfig];
    } catch (error) {
        console.error('Error detecting WireGuard interfaces:', error);
        return [];
    }
}

// API endpoint to retrieve interface details including clients
server.get('/interfaces', async (req, res) => {
    try {
        const interfaces = await detectWireguardInterfaces();
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
    const { name, port } = req.body;

    if (!name || !port) {
        return res.status(400).json({ error: 'Interface name and port are required.' });
    }

    try {
        const { privateKey, publicKey } = await generateKeyPair();
        const serverConfig = {
            wgInterface: {
                privateKey,
                listenPort: port,
                address: ['10.7.0.1/24'],  // Adjust this as needed
                saveConfig: true,
            },
            peers: []
        };

        const configFilePath = path.join(WG_CONFIG_DIR, `${name}.conf`);
        await writeConfig({ filePath: configFilePath, config: serverConfig });
        
        // Create a WgConfig instance to manage the WireGuard interface
        const wgConfig = new WgConfig({ filePath: configFilePath });
        await wgConfig.up();

        res.json({ message: `WireGuard interface ${name} created successfully.` });
    } catch (error) {
        console.error('Error creating WireGuard interface:', error);
        res.status(500).json({ error: 'Failed to create WireGuard interface.' });
    }
});

// API endpoint to delete a WireGuard interface
server.delete('/delete/:name', async (req, res) => {
    const { name } = req.params;

    if (!name) {
        return res.status(400).json({ error: 'Interface name is required.' });
    }

    try {
        const configFilePath = path.join(WG_CONFIG_DIR, `${name}.conf`);
        const wgConfig = new WgConfig({ filePath: configFilePath });
        await wgConfig.down();
        try {
            await fs.unlink(configFilePath);
            console.log(`Configuration file ${configFilePath} deleted.`);
        } catch (err) {
            console.warn(`Could not delete config file for ${name}:`, err.message);
        }

        res.json({ message: `WireGuard interface ${name} deleted successfully.` });
    } catch (error) {
        console.error('Error deleting WireGuard interface:', error);
        res.status(500).json({ error: 'Failed to delete WireGuard interface.' });
    }
});

// API endpoint to enable/disable a WireGuard interface
server.post('/toggle/:name', async (req, res) => {
    const { name } = req.params;
    const { status } = req.body;

    if (!name || !status) {
        return res.status(400).json({ error: 'Interface name and status are required.' });
    }

    if (status !== 'up' && status !== 'down') {
        return res.status(400).json({ error: 'Status must be either "up" or "down".' });
    }

    const configFilePath = path.join(WG_CONFIG_DIR, `${name}.conf`);

    try {
        // Ensure the config file exists
        await makeSureFileExists(configFilePath);

        // Create a WgConfig instance to manage the WireGuard interface
        const wgConfig = new WgConfig({ filePath: configFilePath });

        if (status === 'up') {
            await wgConfig.up();
            return res.json({ message: `WireGuard interface ${name} is up.` });
        } else if (status === 'down') {
            await wgConfig.down();
            return res.json({ message: `WireGuard interface ${name} is down.` });
        }
    } catch (error) {
        console.error(`Error toggling WireGuard interface ${name}:`, error);
        return res.status(500).json({ error: `Failed to ${status} WireGuard interface ${name}.` });
    }
});

// API endpoint to check if WireGuard is installed
server.get('/check', async (req, res) => {
    let installedStatus = "not ok";
    let directoryStatus = "not ok";
    let errorCode = null;

    try {
        // Check if WireGuard is installed
        await ensureWireGuardInstalled();
        installedStatus = "ok";

        try {
            // Ensure the WireGuard directory exists
            await makeSureDirExists(WG_CONFIG_DIR);
            directoryStatus = "ok";
        } catch (dirError) {
            directoryStatus = "not ok";
            errorCode = "DIR_NOT_FOUND"; // Directory not found error code
        }
    } catch (error) {
        errorCode = "WIREGUARD_INSTALL_FAILED"; // WireGuard installation failed error code
    }

    res.json({
        installed: installedStatus,
        directory: directoryStatus,
        errorCode: errorCode
    });
});

module.exports = server;
