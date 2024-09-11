const express = require('express');
const fs = require('fs');
const path = require('path');
const { executeCommand, executeSudoCommand } = require('./executer.cjs');

const router = express.Router();

let previousRx = {};
let previousTx = {};
let previousTimestamp = Date.now();

async function getNetworkInterfaces() {
    const data = await executeCommand('nmcli device show');
    const interfaces = {};

    const blocks = data.split('\n\n');
    blocks.forEach(block => {
        const lines = block.split('\n');
        const result = {
            ip4: [],
            ip6: [],
            ip4Routes: [],
            ip6Routes: [],
            dns: []
        };

        lines.forEach(line => {
            const [key, value] = line.split(/:\s+/).map(part => part.trim());

            if (!key || !value) return;

            if (key.startsWith('IP4.ADDRESS')) {
                const [address, prefixLength] = value.split('/');
                result.ip4.push({ address, prefixLength });
            } else if (key.startsWith('IP6.ADDRESS')) {
                const [address, prefixLength] = value.split('/');
                result.ip6.push({ address, prefixLength });
            } else if (key.startsWith('IP4.ROUTE')) {
                const [destination, nextHop, metric] = value.match(/dst = ([^,]+), nh = ([^,]+), mt = ([^,]+)/).slice(1);
                result.ip4Routes.push({ destination, nextHop, metric });
            } else if (key.startsWith('IP6.ROUTE')) {
                const [destination, nextHop, metric] = value.match(/dst = ([^,]+), nh = ([^,]+), mt = ([^,]+)/).slice(1);
                result.ip6Routes.push({ destination, nextHop, metric });
            } else if (key.startsWith('IP4.DNS')) {
                result.dns.push(value);
            } else if (key === 'GENERAL.DEVICE') {
                result.device = value;
            } else if (key === 'GENERAL.MTU') {
                result.mtu = parseInt(value) || 0;
            } else if (key === 'GENERAL.CARRIER') {
                result.carrierSpeed = value;
            }
        });

        const name = result.device;
        if (name) {
            interfaces[name] = {
                ip4: result.ip4,
                ip6: result.ip6,
                mtu: result.mtu,
                carrierSpeed: result.carrierSpeed,
                rxBytes: 0,
                txBytes: 0,
                dns: result.dns,
                routes: [...result.ip4Routes, ...result.ip6Routes]
            };
        }
    });

    return interfaces;
}

async function getNetworkManagerInterfaces() {
    const data = await executeCommand('nmcli device status');
    const lines = data.split('\n').slice(1); // Skip the header line
    const managedInterfaces = lines
        .filter(line => !line.includes('unmanaged'))
        .map(line => line.split(/\s+/)[0]);
    return managedInterfaces;
}

function getNetworkStatsFromProc() {
    return new Promise((resolve, reject) => {
        fs.readFile('/proc/net/dev', 'utf8', (err, data) => {
            if (err) {
                reject(err);
            } else {
                const interfaces = {};
                const lines = data.split('\n');
                lines.slice(2).forEach(line => {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length > 10) {
                        const name = parts[0].replace(':', '');
                        const rxBytes = parseInt(parts[1]);
                        const txBytes = parseInt(parts[9]);
                        interfaces[name] = { rxBytes, txBytes };
                    }
                });
                resolve(interfaces);
            }
        });
    });
}

function getCarrierSpeed(name) {
    return new Promise((resolve, reject) => {
        const filePath = path.join('/sys/class/net', name, 'speed');
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                resolve('');
            } else {
                const speed = parseInt(data.trim());
                resolve(speed === -1 ? '' : speed);
            }
        });
    });
}

async function getHardwareInfo(req) {
    const password = req.session?.user?.password;
    const data = await executeSudoCommand('lshw -C network',password);
    const hardwareInfo = {};

    const blocks = data.split('\n  *-network').slice(); // Skip the first split part which is before the first device
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

async function getNetworkStats(req) {
    try {
        const interfaces = await getNetworkInterfaces(req);
        const currentTimestamp = Date.now();
        const elapsedTime = (currentTimestamp - previousTimestamp) / 1000;
        previousTimestamp = currentTimestamp;

        const nmInterfaces = await getNetworkManagerInterfaces();
        const procStats = await getNetworkStatsFromProc();
        const hardwareInfo = await getHardwareInfo(req);

        let totalRxSec = 0;
        let totalTxSec = 0;

        const sortedInterfaceNames = Object.keys(interfaces).sort();

        const stats = await Promise.all(sortedInterfaceNames.map(async (name) => {
            const { ip4, ip6, mtu, dns, routes } = interfaces[name];
            const carrierSpeed = await getCarrierSpeed(name);

            const { rxBytes, txBytes } = procStats[name] || { rxBytes: 0, txBytes: 0 };
            interfaces[name].rxBytes = rxBytes;
            interfaces[name].txBytes = txBytes;

            if (!previousRx[name]) previousRx[name] = rxBytes;
            if (!previousTx[name]) previousTx[name] = txBytes;

            const rxSec = (rxBytes - previousRx[name]) / elapsedTime;
            const txSec = (txBytes - previousTx[name]) / elapsedTime;
            previousRx[name] = rxBytes;
            previousTx[name] = txBytes;

            const managedByNetworkManager = nmInterfaces.includes(name);
            const hardware = hardwareInfo[name] || {};

            if (!name.startsWith('veth') && !name.startsWith('docker') && !name.startsWith('br-') && !name.startsWith('lo')) {
                totalRxSec += rxSec;
                totalTxSec += txSec;
            }

            return {
                name,
                ip4,
                ip6,
                mtu,
                carrierSpeed: (ip4.length === 0 && ip6.length === 0) ? '' : carrierSpeed,
                txSec,
                rxSec,
                managedByNetworkManager,
                dns,
                routes,
                hardware
            };
        }));

        const result = {
            totalRxSec,
            totalTxSec,
            interfaces: {},
        };

        stats.forEach(stat => {
            result.interfaces[stat.name] = stat;
            delete stat.name;  // Remove the name from the value
        });

        return result;
    } catch (error) {
        throw new Error(error.toString());
    }
}

// Route to get network statistics
router.get('/network', async (req, res) => {
    try {
        const stats = await getNetworkStats(req);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

// Helper function to parse the nmcli output into JSON
function parseNmcliOutput(output) {
    const result = {
        ip4: [],
        ip6: [],
        ip4Routes: [],
        ip6Routes: [],
        dns: [],
    };

    const lines = output.split('\n');

    lines.forEach(line => {
        const [key, value] = line.split(/:\s+/).map(part => part.trim());

        if (!key || !value) return;

        if (key.startsWith('IP4.ADDRESS')) {
            const [address, prefixLength] = value.split('/');
            result.ip4.push({ address, prefixLength });
        } else if (key.startsWith('IP6.ADDRESS')) {
            const [address, prefixLength] = value.split('/');
            result.ip6.push({ address, prefixLength });
        } else if (key.startsWith('IP4.ROUTE')) {
            const [destination, nextHop, metric] = value.match(/dst = ([^,]+), nh = ([^,]+), mt = ([^,]+)/).slice(1);
            result.ip4Routes.push({ destination, nextHop, metric });
        } else if (key.startsWith('IP6.ROUTE')) {
            const [destination, nextHop, metric] = value.match(/dst = ([^,]+), nh = ([^,]+), mt = ([^,]+)/).slice(1);
            result.ip6Routes.push({ destination, nextHop, metric });
        } else if (key.startsWith('IP4.DNS')) {
            result.dns.push(value);
        } else if (key === 'GENERAL.DEVICE') {
            result.general_device = value;
        } else if (key === 'GENERAL.TYPE') {
            result.general_type = value;
        } else if (key === 'GENERAL.HWADDR') {
            result.general_hwaddr = value;
        } else if (key === 'GENERAL.MTU') {
            result.general_mtu = value;
        } else if (key === 'GENERAL.STATE') {
            result.general_state = value;
        } else if (key === 'GENERAL.CONNECTION') {
            result.general_connection = value;
        } else if (key === 'GENERAL.CON-PATH') {
            result.general_conPath = value;
        } else if (key === 'WIRED-PROPERTIES.CARRIER') {
            result.wired_properties_carrier = value;
        } else if (key === 'IP4.GATEWAY') {
            result.ip4_gateway = value;
        } else if (key === 'IP6.GATEWAY') {
            result.ip6_gateway = value;
        } else if (key === 'GENERAL.CONNECTION') {
            result.general_connection = value;
        } else if (key === 'GENERAL.STATE') {
            result.general_state = value;
        } else if (key === 'WIRED-PROPERTIES.CARRIER') {
            result.carrierSpeed = value;
        }
    });

    return result;
}

module.exports = router;