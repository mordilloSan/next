const dgram = require('dgram');
const { networkInterfaces } = require('os');
const { stat, mkdir, readdir, readFile } = require('fs').promises;
const { executeCommand, executeSudoCommand } = require('./executer.cjs');
const path = require('path');
const config = require('./config.cjs');

class WireGuardManager {
  constructor() {
    this.configDir = config.WG_CONFIG_DIR;
  }

  async restartWireGuardInterface(req, interfaceName) {
    const password = req.session?.user?.password;
    try {
      // Check if the interface is already up by running `wg show`
      const status = await executeSudoCommand(`wg show ${interfaceName}`,password);

      // If the interface is not up, the output will be empty or indicate it's down
      const isInterfaceUp = status && status.includes('interface');

      if (isInterfaceUp) {
        // If the interface is already up, bring it down and up again
        console.log(`Restarting WireGuard interface ${interfaceName}...`);
        await executeCommand(`wg-quick down ${interfaceName}`);
        await executeCommand(`wg-quick up ${interfaceName}`);
      } else {
        // If the interface is not up, just bring it up
        console.log(`Starting WireGuard interface ${interfaceName}...`);
        await executeCommand(`wg-quick up ${interfaceName}`);
      }

      return { success: true, message: `Interface ${interfaceName} is now up and running.` };
    } catch (error) {
      console.error(`Error managing WireGuard interface ${interfaceName}:`, error);
      return { success: false, error: `Failed to manage WireGuard interface: ${error.message}` };
    }
  };

  // Helper function to increment an IP address
  incrementIPAddress(ip) {
    const ipParts = ip.split('.').map(Number);
    for (let i = ipParts.length - 1; i >= 0; i--) {
      ipParts[i]++;
      if (ipParts[i] <= 255) break;
      ipParts[i] = 0; // Reset to 0 and carry the increment to the next octet
    }
    return ipParts.join('.');
  };

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

        // Fetch the connection status using 'wg show' command
        let isConnected = false;
        try {
          const stdout = await executeCommand(`ip link show ${interfaceName}`);
          isConnected = stdout.includes('UP');  // Check for 'UP' in the output
        } catch (error) {
          isConnected = false;  // If the command fails, the interface is not active
        }

        // Fetch peer information using the getPeersForInterface function
        const peers = await this.getPeersForInterface(interfaceName);

        // Push extracted data to the interfaces array, including peers
        interfaces.push({
          name: interfaceName,  // Use filename as interface name
          address: interfaceAddress,
          port: interfacePort,
          peerCount: peerCount,
          isConnected: isConnected ? 'Active' : 'Inactive',
          peerData: peers,  // Add the peer information here
        });
      }


      return interfaces;

    } catch (error) {
      console.error('Error detecting WireGuard interfaces:', error);
      return [];  // Return empty array in case of an error
    }
  }

  async getPeersForInterface(interfaceName) {
    try {
      const interfaceDir = path.join(this.configDir, interfaceName);  // Folder for the interface (e.g., wg7)

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
          name: peerFile.replace('.conf', ''),  // Use the filename as the peer's name
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

        // Add peer to the peers array
        peers.push(peer);
      }

      return peers;
    } catch (error) {
      console.error(`Error reading peer config files for interface ${interfaceName}:`, error);
      throw new Error(`Failed to retrieve peer information for ${interfaceName}`);
    }
  }

  async addPeer(availableIps, endPoint, port, serverPublicKey) {
    const peerKeys = await this.generateKeys();
    const serverConfigContent = `
[Peer]
PublicKey = ${peerKeys.publicKey}
PresharedKey = ${peerKeys.preSharedKey}
AllowedIPs = ${availableIps}/32
`;

    const peerConfigContent = `
[Interface]
Address = ${availableIps}/32
PrivateKey = ${peerKeys.privateKey}
ListenPort = ${port}

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
}

module.exports = new WireGuardManager();