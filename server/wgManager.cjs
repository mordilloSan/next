const dgram = require('dgram');
const { networkInterfaces } = require('os');
const { stat, mkdir, readdir } = require('fs').promises;
const { executeCommand, executeSudoCommand } = require('./executer.cjs');

const WG_CONFIG_DIR = '/etc/wireguard';

class WireGuardManager {
    constructor() {
        this.configDir = WG_CONFIG_DIR;
    }

    async getHardwareInfo(req) {
        const { user } = req.session;
        const password = user?.password;
        const data = await executeSudoCommand('lshw -C network', password);
        const hardwareInfo = {};

        const blocks = data.split('\n  *-network').slice();
        blocks.forEach(block => {
            const lines = block.trim().split('\n');
            let iface = {};
            let logicalName = '';

            lines.forEach(line => {
                line = line.trim();

                if (line.startsWith('logical name:')) {
                    logicalName = line.split(':')[1].trim();
                    iface.logicalName = logicalName;
                } else if (line.startsWith('product:')) {
                    iface.product = line.split(':')[1].trim();
                } else if (line.startsWith('vendor:')) {
                    iface.vendor = line.split(':')[1].trim();
                } else if (line.startsWith('description:')) {
                    iface.description = line.split(':')[1].trim();
                }
            });

            hardwareInfo[logicalName] = iface;
        });

        return hardwareInfo;
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

    async detectWireguardInterfaces(req) {
        try {
            const { user } = req.session;
            const password = user ? user.password : null;
            const stdout = await executeSudoCommand('wg show', password);
            const activeInterfaces = stdout
                .split('\n')
                .map(line => line.match(/^interface: (\w+)/))
                .filter(match => match !== null)
                .map(match => match[1]);

            await mkdir(this.configDir, { recursive: true });
            const files = await readdir(this.configDir);
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
}

module.exports = new WireGuardManager();