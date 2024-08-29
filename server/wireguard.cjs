const express = require('express');
const fs = require('fs').promises;
const dgram = require('dgram');
const path = require('path');
const { stat, mkdir } = require('fs').promises;
const { networkInterfaces } = require('os');
const { executeCommand, executeSudoCommand } = require('./executer.cjs');
const WG_CONFIG_DIR = '/etc/wireguard';
const server = express.Router();

// Make sure a directory exists on the file system
const makeSureDirExists = async (path) => {
    try {
        const stats = await stat(path);
        if (!stats.isDirectory()) { throw new Error(`${path} exists but is not a directory`); }
        return 'Directory already exists';
    } catch (e) {
        if (e.code === 'ENOENT') {
            await mkdir(path, { recursive: true });
            return 'Directory created';
        } else { throw e; } // Rethrow other errors
    }
};

function isIPAddressAvailable(ipAddress) {
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && net.address === ipAddress) {
                return false;
            }
        }
    }
    return true;
}

// Convert an IP address from dotted-decimal to a long integer
function ipToLong(ip) {
    return ip.split('.').reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)), 0) >>> 0;
}

// Convert a long integer to a dotted-decimal IP address
function longToIp(long) {
    return [
        (long >>> 24) & 255,
        (long >>> 16) & 255,
        (long >>> 8) & 255,
        long & 255
    ].join('.');
}

// Calculate the network address and number of hosts in a CIDR
function calculateCIDRDetails(cidr) {
    const [baseIp, prefixLength] = cidr.split('/');
    const subnetMask = ~((1 << (32 - prefixLength)) - 1);
    const networkAddress = ipToLong(baseIp) & subnetMask;
    const numHosts = (1 << (32 - prefixLength)) - 2; // Subtract network and broadcast addresses
    return {
        networkAddress: longToIp(networkAddress),
        numHosts: numHosts,
    };
}

// Utility to get array of IP from a CIDR
function getAvailableIPAddresses(cidr, count) {
    const baseIp = ip.cidrSubnet(cidr).networkAddress;
    const subnetSize = ip.cidrSubnet(cidr).numHosts;
    const availableIps = [];
    let currentIndex = 1; // Start from the first available IP in the range

    while (availableIps.length < count && currentIndex < subnetSize) {
        const nextIp = ip.fromLong(ip.toLong(baseIp) + currentIndex);
        if (isIPAddressAvailable(nextIp)) {
            availableIps.push(nextIp);
        }
        currentIndex++;
    }

    if (availableIps.length < count) {
        throw new Error(`Not enough available IP addresses in the CIDR range ${cidr}`);
    }

    return availableIps;
}

// Utility function to calculate the next IP in a given CIDR range
function getNextIPAddress(cidr, index) {
    const [base, subnet] = cidr.split('/');
    const ipParts = base.split('.').map(part => parseInt(part, 10));
    ipParts[3] += index;
    return ipParts.join('.') + '/' + subnet;
}

// Function to generate keys
async function generateKeys() {
    const stripWhiteSpace = (s) => s.replace(/\s/g, '')
    const privateKey = await executeCommand(`wg genkey`)
    const publicKey = await executeCommand(`echo "${privateKey}" | wg pubkey`)
    const preSharedKey = await executeCommand(`wg genpsk`)
    return {
        privateKey: stripWhiteSpace(privateKey),
        publicKey: stripWhiteSpace(publicKey),
        preSharedKey: stripWhiteSpace(preSharedKey)
    }
}

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
        const version = await executeCommand('wg -v')
        console.log('WireGuard version - ', version);
        return version
    } catch (error) {
        throw new Error('Wireguard is not installed on the system. Please install wg and wg-quick')
    }
}

// Function to detect possible WireGuard interfaces
async function detectWireguardInterfaces(req) {
    try {
        const { user } = req.session;
        const password = user?.password;
        const stdout = await executeSudoCommand('wg show', password);
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
        const interfaces = await detectWireguardInterfaces(req);
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
    const { serverName, port, serverAddress, peers } = req.body;

    if (!serverName || !port || !serverAddress | !peers) {
        return res.status(400).json({ error: 'More data is required.' });
    }

    if (await detectUdpPortInUse(port)) {
        return res.status(400).json({ error: 'Port is already used.' });
    }

    const filePath = path.join(WG_CONFIG_DIR, `${serverName}.conf`);
    try {


        res.json({ message: `WireGuard interface ${serverName} created successfully.` });
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
        const interfaces = await detectWireguardInterfaces(req);
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
        wgVersion = await ensureWireGuardInstalled();
        installedStatus = "ok";

        try {
            // Ensure the WireGuard directory exists
            directoryMessage = await makeSureDirExists(WG_CONFIG_DIR);
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
