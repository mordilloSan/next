const express = require('express');
const si = require('systeminformation');
const fs = require('fs').promises;
const { executeCommand } = require('./executer.cjs');

const router = express.Router();

async function getManagedInterfaces() {
  const data = await executeCommand('nmcli device status');
  return data
    .split('\n')
    .slice(1) // Skip header line
    .filter(line => !line.includes('unmanaged'))
    .map(line => line.split(/\s+/)[0]);
}

// Helper for async route error handling
const asyncHandler = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Function to get carrier speed for interfaces
async function getCarrierSpeeds(interfaces) {
  const speedPromises = interfaces.map(async iface => {
    try {
      const speedPath = `/sys/class/net/${iface}/speed`;
      const speedData = await fs.readFile(speedPath, 'utf8');
      const speed = parseInt(speedData.trim(), 10);
      return { iface, carrierSpeed: speed === -1 ? 'N/A' : `${speed} Mbps` };
    } catch (error) {
      return { iface, carrierSpeed: 'N/A' };
    }
  });

  return Promise.all(speedPromises);
}

// Route to get combined network info for managed interfaces
router.get('/networkinfo', asyncHandler(async (req, res) => {
  try {
    // Step 1: Get network statistics
    const managedInterfaces = await getManagedInterfaces();
    const statsArray = await Promise.all(managedInterfaces.map(iface => si.networkStats(iface)));
    const stats = statsArray.flat();

    const [hardwareData, ipData] = await Promise.all([
      executeCommand('lshw -C network -json'),
      executeCommand('ip -json address')
    ]);
    const hardwareInfo = JSON.parse(hardwareData);
    const ipInfo = JSON.parse(ipData);

    // Get carrier speeds for managed interfaces
    const carrierSpeeds = await getCarrierSpeeds(managedInterfaces);

    // Step 4: Combine all information and calculate totals for physical NICs
    let totalTxSec = 0;
    let totalRxSec = 0;

    const combinedInfo = stats.map(stat => {
      const hw = hardwareInfo.find(hw => hw.logicalname === stat.iface) || {};
      const ipDetails = ipInfo.find(ip => ip.ifname === stat.iface) || {};
      const ip4 = ipDetails.addr_info?.filter(addr => addr.family === "inet") || [];
      const ip6 = ipDetails.addr_info?.filter(addr => addr.family === "inet6") || [];

      const carrierSpeedInfo = carrierSpeeds.find(cs => cs.iface === stat.iface);
      const carrierSpeed = carrierSpeedInfo ? carrierSpeedInfo.carrierSpeed : 'N/A';

      // Sum up tx_sec and rx_sec for physical NICs
      if (hw.description && !hw.description.includes('virtual')) {
        totalTxSec += stat.tx_sec || 0;
        totalRxSec += stat.rx_sec || 0;
      }

      return {
        iface: stat.iface,
        operstate: stat.operstate,
        rx_bytes: stat.rx_bytes,
        tx_bytes: stat.tx_bytes,
        rx_sec: stat.rx_sec,
        tx_sec: stat.tx_sec,
        vendor: hw.vendor || 'N/A',
        product: hw.product || 'N/A',
        description: hw.description || 'N/A',
        carrierSpeed,
        ip4: ip4.map(ip => ({ address: ip.local, prefixLength: ip.prefixlen })),
        ip6: ip6.map(ip => ({ address: ip.local, prefixLength: ip.prefixlen }))
      };
    });

    // Add combined TX/RX data to the response
    const response = {
      totalTxSec,
      totalRxSec,
      interfaces: combinedInfo
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.toString() });
  }
}));

// Route to get hardware info for a specific network interface
router.get('/hardwareinfo/:interface', asyncHandler(async (req, res) => {
  const interfaceName = req.params.interface;
  const data = await executeCommand('lshw -C network -json');
  const hardwareInfo = JSON.parse(data);
  const specificInterface = hardwareInfo.find(iface => iface.logicalname === interfaceName);

  if (!specificInterface) {
    return res.status(404).json({ error: `Interface ${interfaceName} not found` });
  }
  res.json(specificInterface);
}));

async function initNetworkStats() {
  try {
    await si.networkStats();
    console.log("Network Stats cached successfully.");
  } catch (error) {
    console.error("Failed to cache Network Stats", error.message);
  }
}

module.exports = { router, initNetworkStats };
