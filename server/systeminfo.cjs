const express = require('express');
const si = require('systeminformation');
const os = require('os');
const { sensors } = require('./sensors.cjs');

const router = express.Router();

router.get('/:endpoint', async (req, res) => {
  const { endpoint } = req.params;

  try {
    switch (endpoint) {
      case 'time':
        const timeInfo = await si.time();
        return res.json({ time: timeInfo });

      case 'cpu':
        const cpuInfo = await si.cpu();
        let currentLoad = await si.currentLoad();
        const cpuTempInfo = await si.cpuTemperature();
        const loadAverages = os.loadavg();

        currentLoad = {
          ...currentLoad,
          cpuLoadAverages: loadAverages,
        };

        currentLoad = Object.entries(currentLoad).reduce((acc, [key, value]) => {
          if (!key.startsWith('raw')) {
            acc[key] = value;
          }
          return acc;
        }, {});

        return res.json({
          cpu: cpuInfo,
          currentLoad,
          temperatures: {
            cores: cpuTempInfo.cores,
            max: cpuTempInfo.max,
          },
        });

      case 'graphics':
        const graphicsInfo = await si.graphics();
        return res.json({ graphics: graphicsInfo });

      case 'mem':
        const memInfo = await si.mem();
        return res.json({ mem: memInfo });

      case 'baseboard':
        const baseboardInfo = await si.baseboard();
        const biosInfo = await si.bios();
        const baseboardTempInfo = await si.cpuTemperature();
        const systemInfo = await si.uuid();
        const timeData = await si.time();
        return res.json({
          baseboard: baseboardInfo,
          bios: biosInfo,
          machineId: systemInfo.os,
          uptime: timeData.uptime,
          temperatures: {
            socket: baseboardTempInfo.socket,
          },
        });

      case 'fsStats':
        const fsStatsInfo = await si.fsStats();
        const ioInfo = await si.disksIO();
        return res.json({
          fsStats: fsStatsInfo,
          disksIO: ioInfo,
        });

      case 'diskLayout':
        const diskInfo = await si.diskLayout();
        // Enhance diskInfo with temperature data
        const { data, error } = await sensors();
        if (error) {
          return res.status(500).json({
            error: "Failed to retrieve sensor data",
            details: error.message,
          });
        }
        const enhancedDiskInfo = diskInfo.map(disk => {
          if (disk.interfaceType === 'PCIe' && disk.type === 'NVMe') {
            const nvmeSensorData = data['nvme-pci-0100'];
            if (nvmeSensorData && nvmeSensorData['PCI adapter']) {
              const tempData = nvmeSensorData['PCI adapter']['Composite'];
              if (tempData) {
                return {
                  ...disk,
                  temperature: tempData.value,
                };
              }
            }
          }
          return disk; // return disk as is if no matching sensor data found
        });

        return res.json({
          diskLayout: enhancedDiskInfo,
          currentTime: data.currentTime,
        });

      case 'temperatures':
        const temperatureInfo = await si.cpuTemperature();
        return res.json({ temperatures: temperatureInfo });

      case 'os':
        const osInfo = await si.osInfo();
        return res.json({ os: osInfo });

      case 'services':
        const servicesInfo = await si.services("*");
        return res.json({ services: servicesInfo });

      case 'processes':
        const processesInfo = await si.processes();
        return res.json({ processes: processesInfo });

      default:
        return res.status(404).json({ error: 'Invalid endpoint' });
    }
  } catch (error) {
    return res.status(500).json({
      error: `Failed to retrieve ${endpoint} information`,
      details: error.message,
    });
  }
});

module.exports = router;
