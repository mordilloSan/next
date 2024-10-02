// wgManager.js

'use strict';

const dgram = require('dgram');
const { networkInterfaces } = require('os');
const { stat, mkdir, readdir, readFile, writeFile, unlink, access, rm } = require('fs').promises;
const path = require('path');
const config = require('./config.cjs');
const QRCode = require('qrcode');
const { executeCommand, executeSudoCommand } = require('./executer.cjs');
const { existsSync } = require('fs'); // Import existsSync

class WireGuardManager {
  constructor() {
    this.configDir = config.WG_CONFIG_DIR;
  }

  // Ensure directory exists
  async makeSureDirExists(dirPath) {
    try {
      const stats = await stat(dirPath);
      if (!stats.isDirectory()) {
        throw new Error(`${dirPath} exists but is not a directory`);
      }
      return 'Directory already exists';
    } catch (e) {
      if (e.code === 'ENOENT') {
        await mkdir(dirPath, { recursive: true });
        return 'Directory created';
      } else {
        throw e;
      }
    }
  }

  // Add a new peer
  async addPeer(availableIp, endPoint, port, serverPublicKey) {
    const peerKeys = await this.generateKeys();
    const serverConfigContent = `
[Peer]
PublicKey = ${peerKeys.publicKey}
PresharedKey = ${peerKeys.preSharedKey}
AllowedIPs = ${availableIp}/32`;

    const peerConfigContent = `
[Interface]
PrivateKey = ${peerKeys.privateKey}
Address = ${availableIp}/32
DNS = 1.1.1.1

[Peer]
PublicKey = ${serverPublicKey}
PresharedKey = ${peerKeys.preSharedKey}
AllowedIPs = 0.0.0.0/0, ::/0
Endpoint = ${endPoint}:${port}
PersistentKeepalive = 25
`.trim();

    return {
      serverConfigContent,
      peerConfigContent,
    };
  }

  // Check if WireGuard is installed
  async ensureWireGuardInstalled() {
    try {
      const version = await executeCommand('wg -v');
      return version;
    } catch (error) {
      throw new Error('WireGuard is not installed on the system. Please install wg and wg-quick');
    }
  }

  // Restart or start the WireGuard interface
  async restartWireGuardInterface(interfaceName) {
    try {
      let isInterfaceUp = false;
      try {
        const status = await executeCommand(`ip link show ${interfaceName}`);
        isInterfaceUp = status && (status.includes('state UP') || status.includes('state UNKNOWN'));
      } catch (error) {
        throw new Error(`Interface ${interfaceName} is not up or does not exist yet: ${error.message}`);
      }
      if (isInterfaceUp) {
        await executeCommand(`wg-quick down ${interfaceName}`);
        await executeCommand(`wg-quick up ${interfaceName}`);
      }
      return { success: true, message: `Interface ${interfaceName} is now up and running.` };
    } catch (error) {
      return { success: false, error: `Failed to manage WireGuard interface: ${error.message}` };
    }
  }

  // Detect WireGuard interfaces
  async detectWireguardInterfaces() {
    try {
      // Read the contents of the config directory
      const files = await readdir(this.configDir);

      // Filter to only include .conf files
      const confFiles = files.filter(file => file.endsWith('.conf'));

      const interfaces = [];

      // Process each .conf file
      for (const file of confFiles) {
        const filePath = path.join(this.configDir, file);
        const fileContent = await readFile(filePath, 'utf8');

        // Extract interface information
        const interfaceMatch = fileContent.match(/\[Interface\][\s\S]*?Address\s*=\s*([\d.\/]+)/);
        const portMatch = fileContent.match(/ListenPort\s*=\s*(\d+)/);
        const peerMatches = fileContent.match(/\[Peer\]/g);

        const interfaceAddress = interfaceMatch ? interfaceMatch[1] : 'Unknown';
        const interfacePort = portMatch ? portMatch[1] : 'Unknown';
        const peerCount = peerMatches ? peerMatches.length : 0;

        // Get the interface name from the filename
        const interfaceName = file.replace('.conf', '');

        // Fetch the connection status using 'ip link show' command
        let isConnected = false;
        try {
          const stdout = await executeCommand(`ip link show ${interfaceName}`);
          isConnected = stdout.includes('UP'); // Check for 'UP' in the output
        } catch (error) {
          isConnected = false; // If the command fails, the interface is not active
        }

        // Fetch peer information using the getPeersForInterface function
        const peers = await this.getPeersForInterface(interfaceName);

        // Push extracted data to the interfaces array, including peers
        interfaces.push({
          name: interfaceName, // Use filename as interface name
          address: interfaceAddress,
          port: interfacePort,
          peerCount: peerCount,
          isConnected: isConnected ? 'Active' : 'Inactive',
          peerData: peers, // Add the peer information here
        });
      }

      return interfaces;
    } catch (error) {
      return []; // Return empty array in case of an error
    }
  }

  // Get peers for a specific interface
  async getPeersForInterface(interfaceName) {
    try {
      const interfaceDir = path.join(this.configDir, interfaceName); // Folder for the interface

      // Read all files in the interface's directory
      const files = await readdir(interfaceDir);

      // Filter for peer config files (assuming they end with .conf)
      const peerConfFiles = files.filter(file => file.endsWith('.conf'));

      const peers = [];

      // Process each peer config file
      for (const peerFile of peerConfFiles) {
        const filePath = path.join(interfaceDir, peerFile);
        const fileContent = await readFile(filePath, 'utf8');

        const peer = {
          name: peerFile.replace('.conf', ''), // Use the filename as the peer's name
        };

        // Split the file content into lines and process each line
        const lines = fileContent.split('\n');
        lines.forEach((line) => {
          line = line.trim();
          if (line.startsWith('PrivateKey =')) {
            peer.privateKey = line.split('=')[1].trim();
          } else if (line.startsWith('PresharedKey =')) {
            peer.presharedKey = line.split('=')[1].trim();
          } else if (line.startsWith('AllowedIPs =')) {
            peer.allowedIPs = line.split('=')[1].trim();
          } else if (line.startsWith('PersistentKeepalive =')) {
            peer.keepAlive = line.split('=')[1].trim();
          } else if (line.startsWith('Address =')) {
            peer.addressIP = line.split('=')[1].trim();
          }
        });
        peers.push(peer);
      }
      return peers;
    } catch (error) {
      throw new Error('Failed to retrieve peer information for ${ interfaceName }');
    }
  }

  // Delete a client (peer)
  async deleteClient(interfaceName, clientName) {
    try {
      // Paths
      const interfaceDir = path.join(this.configDir, interfaceName);
      const clientConfigPath = path.join(interfaceDir, `${clientName}.conf`);

      // Check if the client configuration file exists
      try {
        await access(clientConfigPath);
      } catch (err) {
        throw new Error(`Client configuration file ${clientConfigPath} does not exist.`);
      }

      // Read the client's configuration to get the PrivateKey
      const clientConfigContent = await readFile(clientConfigPath, 'utf8');
      const clientPrivateKeyMatch = clientConfigContent.match(/PrivateKey\s*=\s*([A-Za-z0-9+/=]+)/);
      if (!clientPrivateKeyMatch) {
        throw new Error('Failed to find PrivateKey in client configuration.');
      }
      const clientPrivateKey = clientPrivateKeyMatch[1];
      const clientPublicKey = await executeCommand(`echo "${clientPrivateKey}" | wg pubkey`);

      // Read the server configuration
      const configFilePath = path.join(this.configDir, `${interfaceName}.conf`);
      const existingConfigContent = await readFile(configFilePath, 'utf8');

      // Remove the client [Peer] section
      const updatedConfigContent = existingConfigContent.replace(
        new RegExp(`\\[Peer\\][\\s\\S]*?PublicKey = ${clientPublicKey.trim()}[\\s\\S]*?(?=\\n\\[|$)`, 'g'),
        ''
      );

      await writeFile(configFilePath, updatedConfigContent.trim());

      // Delete client's config and QR code
      const qrCodePath = path.join(interfaceDir, `${clientName}.png`);
      await unlink(clientConfigPath);
      try {
        await access(qrCodePath);
        await unlink(qrCodePath);
      } catch (err) {
        // QR code doesn't exist, ignore
      }

      // Restart the WireGuard interface
      await this.restartWireGuardInterface(interfaceName);

      return { message: `Client ${clientName} deleted successfully.` };
    } catch (error) {
      throw new Error('Failed to delete client.');
    }
  }

  // Get client configuration content
  async getClientConfiguration(interfaceName, clientName) {
    try {
      const interfaceDir = path.join(this.configDir, interfaceName);
      const clientConfigPath = path.join(interfaceDir, `${clientName}.conf`);

      if (!existsSync(clientConfigPath)) {
        throw new Error(`Client configuration file ${clientName}.conf does not exist.`);
      }

      const clientConfigContent = await readFile(clientConfigPath, 'utf8');
      return clientConfigContent;
    } catch (error) {
      throw new Error('Failed to get client configuration.');
    }
  }

  // Get client QR code as base64
  async getClientQRCode(interfaceName, clientName) {
    try {
      const interfaceDir = path.join(this.configDir, interfaceName);
      const qrCodePath = path.join(interfaceDir, `${clientName}.png`);

      if (!existsSync(qrCodePath)) {
        throw new Error(`QR code file for client ${clientName} does not exist.`);
      }

      const qrCodeImage = await readFile(qrCodePath);
      const base64QRCode = `data:image/png;base64,${qrCodeImage.toString('base64')}`;

      return base64QRCode;
    } catch (error) {
      throw new Error('Failed to get client QR code.');
    }
  }

  // Create a new WireGuard interface
  async createInterface(serverName, port, CIDR, peers, nic) {
    let availableIps;
    let configContent = "";

    try {
      // Get available IPs for the server and peers
      availableIps = this.getAvailableIPAddresses(CIDR, peers + 1); // +1 for the server itself
      if (availableIps.length < peers + 1) {
        throw new Error('Not enough available IP addresses in the given CIDR.');
      }

      // Check if the port is available
      const portInUse = await this.detectUdpPortInUse(port);
      if (portInUse) {
        throw new Error('The specified port is already in use.');
      }

      // Check if the interface already exists
      const interfaces = await this.detectWireguardInterfaces();
      const interfaceExists = interfaces.some(iface => iface.name === serverName);

      if (interfaceExists) {
        throw new Error(`WireGuard interface ${serverName} already exists.`);
      }

      // Detect the public IP and generate server keys
      const endPoint = await this.detectPublicIP();
      const serverKeys = await this.generateKeys();

      // Build the server configuration
      configContent = `
[Interface]
Address = ${availableIps[0]}
ListenPort = ${port}
PrivateKey = ${serverKeys.privateKey}
PostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -A FORWARD -o %i -j ACCEPT; iptables -t nat -A POSTROUTING -o ${nic} -j MASQUERADE
PostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -D FORWARD -o %i -j ACCEPT; iptables -t nat -D POSTROUTING -o ${nic} -j MASQUERADE
`.trim();

      // Ensure the server directory exists
      const serverDirPath = path.join(this.configDir, serverName);
      await mkdir(serverDirPath, { recursive: true });

      // Add peers
      for (let i = 0; i < peers; i++) {
        const { serverConfigContent, peerConfigContent } = await this.addPeer(availableIps[i + 1], endPoint, port, serverKeys.publicKey);
        configContent += `\n${serverConfigContent}`;
        const peerConfigPath = path.join(serverDirPath, `peer${i + 1}.conf`);
        await writeFile(peerConfigPath, peerConfigContent);
        const qrCodePath = path.join(serverDirPath, `peer${i + 1}.png`);
        await QRCode.toFile(qrCodePath, peerConfigContent);
      }

      // Write the server configuration to a file
      const filePath = path.join(this.configDir, `${serverName}.conf`);
      await writeFile(filePath, configContent);
      await executeCommand(`wg-quick up ${filePath}`);
      return { message: `WireGuard interface ${serverName} created and running successfully.` };
    } catch (error) {
      throw new Error(`Failed to create WireGuard interface: ${error.message}`);
    }
  }

  // Delete a WireGuard interface
  async deleteInterface(name) {
    const configFilePath = path.join(this.configDir, `${name}.conf`);
    const clientFolderPath = path.join(this.configDir, name);

    try {
      await access(configFilePath);

      try {
        await executeCommand(`wg-quick down ${configFilePath}`);
      } catch (err) {
        if (err.message.includes('is not a WireGuard interface')) {
          // Interface is not up; proceed without throwing an error
        } else {
          throw new Error(`Failed to bring down WireGuard interface ${name}: ${err.message}`);
        }
      }

      try {
        await access(clientFolderPath);
        await rm(clientFolderPath, { recursive: true, force: true });
      } catch (err) {
        if (err.code !== 'ENOENT') {
          throw new Error(`Failed to delete client configuration folder for interface ${name}.`);
        }
      }

      await unlink(configFilePath);
      return { message: `WireGuard interface ${name} deleted successfully.` };
    } catch (e) {
      if (e.code === 'ENOENT') {
        throw new Error(`Configuration file for interface ${name} does not exist.`);
      }
      throw new Error(`Failed to access configuration file for interface ${name}.`);
    }
  }

  // Start or stop a WireGuard interface
  async toggleInterface(name, status) {
    const configFilePath = path.join(this.configDir, `${name}.conf`);

    try {
      // Check if the config file exists
      await access(configFilePath);

      // Retrieve the current status of all interfaces
      const interfaces = await this.detectWireguardInterfaces();
      const interfaceDetails = interfaces.find(iface => iface.name === name);

      if (!interfaceDetails) {
        throw new Error(`Interface ${name} not found.`);
      }

      const currentStatus = interfaceDetails.isConnected === 'Active' ? 'up' : 'down';

      // Compare requested status with current status
      if (currentStatus === status) {
        return { message: `WireGuard interface ${name} is already ${status}.` };
      }

      // Toggle the WireGuard interface and log the change
      if (status === 'up') {
        await executeCommand(`wg-quick up ${configFilePath}`);
        return { message: `WireGuard interface ${name} is now up.` };
      } else if (status === 'down') {
        await executeCommand(`wg-quick down ${configFilePath}`);
        return { message: `WireGuard interface ${name} is now down.` };
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Configuration file for interface ${name} does not exist.`);
      }
      if (error.message.includes('Address already in use')) {
        throw new Error('The IP address is already in use. Please check the configuration.');
      }
      throw new Error(`Failed to ${status} WireGuard interface ${name}.`);
    }
  }

  // Create a new client (peer)
  async createClient(interfaceName, clientName) {
    try {
      // Paths
      const interfaceDir = path.join(this.configDir, interfaceName);
      const configFilePath = path.join(this.configDir, `${interfaceName}.conf`);

      // Read existing interface configuration
      const existingConfigContent = await readFile(configFilePath, 'utf8');

      // Extract the server IP address
      const addressMatch = existingConfigContent.match(/Address\s*=\s*([0-9\.]+)/);
      if (!addressMatch) {
        throw new Error('Failed to find the server IP address in the interface configuration.');
      }
      const serverIP = addressMatch[1];
      const listenPortMatch = existingConfigContent.match(/ListenPort\s*=\s*(\d+)/);
      if (!listenPortMatch) {
        throw new Error('Failed to find ListenPort in the interface configuration.');
      }
      const listenPort = listenPortMatch[1];

      // Get existing peers to avoid IP conflicts and find the highest peer number
      const peers = await this.getPeersForInterface(interfaceName);
      const existingIps = peers.map(peer => peer.addressIP.split('/')[0]);


      // Include server IP in existing IPs to avoid assigning it
      existingIps.push(serverIP);
      // Determine the next available IP address
      const newIp = this.getNextAvailableIP(serverIP, existingIps);
      // **Generate a unique clientName by detecting the last digit and adding one**
      if (!clientName) {
        // Get existing peer names
        const existingPeerNames = peers.map(peer => peer.name);
        let maxNumber = -1;

        existingPeerNames.forEach(name => {
          // Extract trailing digits
          const match = name.match(/(\d+)$/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNumber) {
              maxNumber = num;
            }
          }
        });

        // Set clientName
        const newNumber = maxNumber + 1; // If no peers, maxNumber is -1, so newNumber will be 0
        clientName = `peer${newNumber}`;
      } else {
        // Check if clientName already exists
        const clientConfigPath = path.join(interfaceDir, `${clientName}.conf`);
        if (existsSync(clientConfigPath)) {
          throw new Error(`Client with name ${clientName} already exists. Please choose a different name.`);
        }
      }

      // Detect public IP and server's public key
      const endPoint = await this.detectPublicIP();

      const serverPrivateKeyMatch = existingConfigContent.match(/PrivateKey\s*=\s*([A-Za-z0-9+/=]+)/);
      if (!serverPrivateKeyMatch) {
        throw new Error('Failed to find the server PrivateKey in the existing configuration.');
      }
      const serverPrivateKey = serverPrivateKeyMatch[1];
      const serverPublicKey = await executeCommand(`echo "${serverPrivateKey}" | wg pubkey`);

      // Generate keys for the client
      const peerKeys = await this.generateKeys();

      // Create client configuration
      const peerConfigContent = `
[Interface]
PrivateKey = ${peerKeys.privateKey}
Address = ${newIp}/32
DNS = 1.1.1.1

[Peer]
PublicKey = ${serverPublicKey.trim()}
PresharedKey = ${peerKeys.preSharedKey}
AllowedIPs = 0.0.0.0/0, ::/0
Endpoint = ${endPoint}:${listenPort}
PersistentKeepalive = 25
`.trim();

      // Save the client's configuration file
      const clientConfigPath = path.join(interfaceDir, `${clientName}.conf`);
      await writeFile(clientConfigPath, peerConfigContent, { mode: 0o600 });

      // Generate QR code for the client
      const qrCodePath = path.join(interfaceDir, `${clientName}.png`);
      await QRCode.toFile(qrCodePath, peerConfigContent);

      // Update the server configuration
      const serverConfigContent = `
[Peer]
PublicKey = ${peerKeys.publicKey}
PresharedKey = ${peerKeys.preSharedKey}
AllowedIPs = ${newIp}/32
`.trim();

      const updatedConfigContent = `${existingConfigContent.trim()}\n\n${serverConfigContent}`;
      await writeFile(configFilePath, updatedConfigContent);

      // Restart the WireGuard interface
      await this.restartWireGuardInterface(interfaceName);

      return { message: `Client ${clientName} added successfully.` };
    } catch (error) {
      throw new Error(error.message || 'Failed to create client.');
    }
  }

  // Generate keys for peers and server
  async generateKeys() {
    const stripWhiteSpace = (s) => s.replace(/\s/g, '');
    const privateKey = await executeCommand(`wg genkey`);
    const publicKey = await executeCommand(`echo "${privateKey}" | wg pubkey`);
    const preSharedKey = await executeCommand(`wg genpsk`);
    return {
      privateKey: stripWhiteSpace(privateKey),
      publicKey: stripWhiteSpace(publicKey),
      preSharedKey: stripWhiteSpace(preSharedKey),
    };
  }

  // Detect if UDP port is in use
  detectUdpPortInUse(port, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const udpTester = dgram.createSocket('udp4');
      let timeoutHandle;

      udpTester.once('error', (err) => {
        clearTimeout(timeoutHandle);
        if (err.code === 'EADDRINUSE') {
          resolve(true);
        } else {
          console.error(`Error checking UDP port ${port}:`, err);
          reject(err);
        }
      });

      udpTester.once('listening', () => {
        clearTimeout(timeoutHandle);
        udpTester.close();
        resolve(false);
      });

      udpTester.bind(port);

      timeoutHandle = setTimeout(() => {
        udpTester.close();
        resolve(false);
      }, timeout);
    });
  }

  // Detect public IP address
  async detectPublicIP() {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      throw new Error('Failed to detect public IP.');
    }
  }

  // Get available IP addresses
  getAvailableIPAddresses(cidr, count, existingIps = []) {
    const { networkAddress, numHosts } = this.calculateCIDRDetails(cidr);
    const availableIps = [];
    let currentIndex = 1;

    while (availableIps.length < count && currentIndex <= numHosts) {
      const nextIp = this.longToIp(this.ipToLong(networkAddress) + currentIndex);
      if (this.isIPAddressAvailable(nextIp) && !existingIps.includes(nextIp)) {
        availableIps.push(nextIp);
      }
      currentIndex++;
    }

    if (availableIps.length < count) {
      throw new Error(`Not enough available IP addresses in the CIDR range ${cidr}`);
    }

    return availableIps;
  }

  // Check if IP address is available
  isIPAddressAvailable(ipAddress) {
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

  // IP address manipulation functions
  ipToLong(ip) {
    return ip.split('.').reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)), 0) >>> 0;
  }

  longToIp(long) {
    return [
      (long >>> 24) & 255,
      (long >>> 16) & 255,
      (long >>> 8) & 255,
      long & 255
    ].join('.');
  }

  calculateCIDRDetails(cidr) {
    const [baseIp, prefixLength] = cidr.split('/');
    const subnetMask = ~((1 << (32 - parseInt(prefixLength, 10))) - 1);
    const networkAddress = this.ipToLong(baseIp) & subnetMask;
    const numHosts = (1 << (32 - parseInt(prefixLength, 10))) - 2;
    return {
      networkAddress: this.longToIp(networkAddress),
      numHosts: numHosts,
    };
  }

  getNextAvailableIP(serverIP, existingIps) {
    // Convert IPs to numeric values for easy comparison
    const ipToNumber = ip => ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0);

    const numberToIp = num => [
      (num >> 24) & 0xFF,
      (num >> 16) & 0xFF,
      (num >> 8) & 0xFF,
      num & 0xFF,
    ].join('.');

    // Convert existing IPs to numbers and sort them
    const existingIpsNum = existingIps.map(ip => ipToNumber(ip)).sort((a, b) => a - b);

    // Start from server IP + 1
    let newIpNum = ipToNumber(serverIP) + 1;

    // Find the next available IP
    while (existingIpsNum.includes(newIpNum)) {
      newIpNum++;
    }

    // Check if the new IP is within valid range (private IP ranges)
    if (newIpNum >= 0xFFFFFFFF) {
      throw new Error('No available IP addresses.');
    }

    const newIp = numberToIp(newIpNum);
    return newIp;
  }

  // Get metrics
  async getMetrics(req) {
    try {
      const password = req.session?.user?.password;
  
      // Execute the command and get the output
      const wgData = await executeSudoCommand('wg show all dump', password);
  
      // Split the output into lines
      const lines = wgData.trim().split('\n');
  
      let totalInterfaces = 0;
      let totalPeers = 0;
      let activeInterfaces = 0;
      let activePeers = 0;
  
      let currentInterface = null;
      const interfaces = {};
  
      for (const line of lines) {
        // Split the line into fields (tab-separated)
        const fields = line.trim().split('\t');
  
        // If the line has 5 fields, it's an interface line
        if (fields.length === 5) {
          const [interfaceName, fwMark] = fields;
          totalInterfaces += 1;
  
          // Determine if the interface is active
          const isInterfaceActive = fwMark.trim() === 'on' ? true : false;
          if (isInterfaceActive) {
            activeInterfaces += 1;
          }
  
          // Initialize the interface entry
          interfaces[interfaceName] = {
            name: interfaceName,
            isActive: isInterfaceActive,
            peers: [],
          };
  
          // Set the current interface context
          currentInterface = interfaceName;
        } else if (fields.length === 9) {
          // Peer line
          const [
            interfaceName,
            publicKey,
            presharedKey,
            endpoint,
            allowedIPs,
            latestHandshake,
            transferRx,
            transferTx,
            persistentKeepalive,
          ] = fields;
  
          totalPeers += 1;
  
          // Determine if the peer is active based on latest handshake or data transfer
          const isPeerActive =
            parseInt(latestHandshake, 10) > 0 ||
            parseInt(transferRx, 10) > 0 ||
            parseInt(transferTx, 10) > 0;
  
          if (isPeerActive) {
            activePeers += 1;
          }
  
          // Add peer to the current interface
          if (currentInterface && interfaces[currentInterface]) {
            interfaces[currentInterface].peers.push({
              publicKey,
              presharedKey,
              endpoint,
              allowedIPs,
              latestHandshake: parseInt(latestHandshake, 10),
              transferRx: parseInt(transferRx, 10),
              transferTx: parseInt(transferTx, 10),
              persistentKeepalive,
              isActive: isPeerActive,
            });
          }
        }
      }
  
      // You can also return more detailed metrics if needed
      return {
        totalInterfaces,
        totalPeers,
        activeInterfaces,
        activePeers,
        interfaces, // Optional: detailed interface and peer information
      };
    } catch (error) {
      console.error('Error getting metrics:', error);
      throw new Error('Failed to get metrics.');
    }
  }
  
}

module.exports = new WireGuardManager();

