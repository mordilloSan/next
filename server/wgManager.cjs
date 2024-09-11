const dgram = require('dgram');
const { networkInterfaces } = require('os');
const { stat, mkdir, readdir, readFile } = require('fs').promises;
const { executeCommand, executeSudoCommand } = require('./executer.cjs');
const path = require('path');
const WG_CONFIG_DIR = '/etc/wireguard';

class WireGuardManager {
  constructor() {
    this.configDir = WG_CONFIG_DIR;
  }

  async getHardwareInfo() {
    try {
      const networkData = await si.networkInterfaces();
      const physicalInterfaces = networkData.filter(iface => !iface.virtual && iface.operstate === 'up');
      const hardwareInfo = physicalInterfaces.reduce((info, iface) => {
        info[iface.iface] = {
          logicalName: iface.iface,
          product: iface.model || 'N/A',
          vendor: iface.vendor || 'N/A',
          description: iface.type || 'N/A',
        };
        return info;
      }, {});
  
      return hardwareInfo;
    } catch (error) {
      console.error('Error fetching hardware info:', error);
      throw new Error('Failed to retrieve hardware information');
    }
  }

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

  getAvailableIPAddresses(cidr, count) {

    const { networkAddress, numHosts } = this.calculateCIDRDetails(cidr);
    const availableIps = [];
    let currentIndex = 1;

    while (availableIps.length < count && currentIndex <= numHosts) {
      const nextIp = this.longToIp(this.ipToLong(networkAddress) + currentIndex);
      if (this.isIPAddressAvailable(nextIp)) {
        availableIps.push(nextIp);
      }
      currentIndex++;
    }

    if (availableIps.length < count) {
      throw new Error(`Not enough available IP addresses in the CIDR range ${cidr}`);
    }

    return availableIps;
  }

  getNextIPAddress(cidr, index) {
    const [base, subnet] = cidr.split('/');
    const ipParts = base.split('.').map(part => parseInt(part, 10));
    ipParts[3] += index;
    return ipParts.join('.') + '/' + subnet;
  }

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

  detectUdpPortInUse(port, timeout = 5000) {
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

  async detectPublicIP() {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      console.error('Error detecting public IP:', error);
      throw new Error('Failed to detect public IP.');
    }
  }

  async ensureWireGuardInstalled() {
    try {
      const version = await executeCommand('wg -v');
      console.log('WireGuard version - ', version);
      return version;
    } catch (error) {
      throw new Error('Wireguard is not installed on the system. Please install wg and wg-quick');
    }
  }

  async detectWireguardDataTransfer(req, interfaceName) {
    const password = req.session?.user?.password;

    try {
      // Execute the command and capture the stdout
      const stdout = await executeSudoCommand(`wg show ${interfaceName} transfer`, password);

      // If the command returns no data (interface down), handle it gracefully
      if (!stdout || stdout.trim().length === 0) {
        console.log(`No transfer data found for interface ${interfaceName}, assuming it's down.`);
        return [{
          peerKey: 'N/A',
          sentBytes: 0,
          receivedBytes: 0,
        }];
      }

      // Split the stdout into lines to process each peer's transfer data
      const transferData = stdout.trim().split('\n').map(line => {
        const [peerKey, sentBytes, receivedBytes] = line.trim().split(/\s+/);

        return {
          peerKey,
          sentBytes: parseInt(sentBytes, 10),
          receivedBytes: parseInt(receivedBytes, 10)
        };
      });

      // Return the parsed data
      return transferData;

    } catch (error) {
      // Handle specific case when the interface is down or doesn't exist
      if (error.message.includes("Unable to access interface: No such device")) {
        return [{
          peerKey: 'N/A',
          sentBytes: 0,
          receivedBytes: 0,
        }];
      }

      // Log and return empty data in case of other errors
      console.error('Error detecting WireGuard data transfer:', error);
      return [{
        peerKey: 'N/A',
        sentBytes: 0,
        receivedBytes: 0,
      }];
    }
  }

  async detectWireguardInterfaces(req) {
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

        // Fetch the connection status using 'wg show' command
        let isConnected = false;
        try {
          const stdout = await executeCommand(`ip link show ${interfaceName}`);
          isConnected = stdout.includes('UP');  // Check for 'UP' in the output
        } catch (error) {
          isConnected = false;  // If the command fails, the interface is not active
        }
        // Fetch the transfer data using detectWireguardDataTransfer function
        let transferData = [];
        try {
          transferData = await this.detectWireguardDataTransfer(req, interfaceName);
        } catch (error) {
          console.error(`Error fetching transfer data for interface ${interfaceName}:`, error);
        }

        // Push extracted data to the interfaces array
        interfaces.push({
          name: interfaceName,  // Use filename as interface name
          address: interfaceAddress,
          port: interfacePort,
          peerCount: peerCount,
          isConnected: isConnected ? 'Active' : 'Inactive',
          transferData: transferData  // Include the transfer data
        });
      }

      return interfaces;

    } catch (error) {
      console.error('Error detecting WireGuard interfaces:', error);
      return [];  // Return empty array in case of an error
    }
  }

// Function to extract peer information from a given interface config file
async getPeersForInterface(interfaceName) {
  try {
    // Read the configuration file for the specified interface
    const filePath = path.join(this.configDir, `${interfaceName}.conf`);
    const fileContent = await readFile(filePath, 'utf8');
    
    const peers = [];
    let peer = {};

    // Split the file content into lines and process each line
    const lines = fileContent.split('\n');
    lines.forEach((line) => {
      line = line.trim();

      if (line.startsWith('[Peer]')) {
        if (peer.publicKey) {
          peers.push(peer); // Push previous peer before starting new one
        }
        peer = {}; // Reset the peer object for the new peer
      } else if (line.startsWith('PublicKey =')) {
        peer.publicKey = line.split('=')[1].trim();
      } else if (line.startsWith('PresharedKey =')) {
        peer.presharedKey = line.split('=')[1].trim();
      } else if (line.startsWith('AllowedIPs =')) {
        peer.allowedIPs = line.split('=')[1].trim();
      }
    });

    // Add the last peer after finishing the loop
    if (peer.publicKey) {
      peers.push(peer);
    }

    return peers;
  } catch (error) {
    console.error(`Error reading config file for interface ${interfaceName}:`, error);
    throw new Error(`Failed to retrieve peer information for ${interfaceName}`);
  }
}


}

module.exports = new WireGuardManager();