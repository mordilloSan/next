const express = require('express');
const si = require('systeminformation');
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

// Middleware to fetch managed interfaces once per request
router.use(asyncHandler(async (req, res, next) => {
  req.managedInterfaces = await getManagedInterfaces();
  next();
}));

// Route to get network statistics for managed interfaces
router.get('/networkstats', asyncHandler(async (req, res) => {
  const stats = await Promise.all(req.managedInterfaces.map(iface => si.networkStats(iface)));
  res.json(stats);
}));

// Route to get network info only for managed interfaces
router.get('/networkinfo', asyncHandler(async (req, res) => {
  const allInterfaces = await si.networkInterfaces();
  const managedInterfacesInfo = allInterfaces.filter(iface => req.managedInterfaces.includes(iface.iface));
  res.json(managedInterfacesInfo);
}));

// Route to get hardware info for a specific network interface
router.get('/hardwareinfo/:interface', asyncHandler(async (req, res) => {
  const interfaceName = req.params.interface
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