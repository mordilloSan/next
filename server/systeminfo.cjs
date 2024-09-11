const express = require('express');
const si = require('systeminformation');
const os = require('os');
const { sensors } = require('./sensors.cjs');

const router = express.Router();

const getSystemInfo = async (endpoint) => {
  switch (endpoint) {
    case 'time': return { time: await si.time() };
    case 'cpu': {
      const [cpuInfo, currentLoad, cpuTempInfo, loadAverages] = await Promise.all([si.cpu(), si.currentLoad(), si.cpuTemperature(), os.loadavg()]);
      return {
        cpu: cpuInfo,
        currentLoad: {
          ...currentLoad,
          cpuLoadAverages: loadAverages,
        },
        temperatures: {
          cores: cpuTempInfo.cores,
          max: cpuTempInfo.max,
        },
      };
    }
    case 'graphics': return { graphics: await si.graphics() };
    case 'mem': return { mem: await si.mem() };
    case 'baseboard': {
      const [baseboardInfo, biosInfo, baseboardTempInfo, systemInfo, timeData] = await Promise.all([si.baseboard(), si.bios(), si.cpuTemperature(), si.uuid(), si.time()]);
      return {
        baseboard: baseboardInfo,
        bios: biosInfo,
        machineId: systemInfo.os,
        uptime: timeData.uptime,
        temperatures: { socket: baseboardTempInfo.socket },
      };
    }
    case 'fsStats': {
      const [fsStatsInfo, ioInfo] = await Promise.all([si.fsStats(), si.disksIO()]);
      return { fsStats: fsStatsInfo, disksIO: ioInfo };
    }
    case 'diskLayout': {
      const diskInfo = await si.diskLayout();
      const { data, error } = await sensors();
      if (error) throw new Error(error);
      const enhancedDiskInfo = diskInfo.map(disk => {
        if (disk.interfaceType === 'PCIe' && disk.type === 'NVMe') {
          const nvmeSensorData = data['nvme-pci-0100'];
          const tempData = nvmeSensorData?.['PCI adapter']?.['Composite'];
          return tempData ? { ...disk, temperature: tempData.value } : disk;
        }
        return disk;
      });
      return { diskLayout: enhancedDiskInfo, currentTime: data.currentTime };
    }
    case 'temperatures': return { temperatures: await si.cpuTemperature() };
    case 'os': return { os: await si.osInfo() };
    case 'services': return { services: await si.services("*") };
    case 'processes': return { processes: await si.processes() };
    default: throw new Error('Invalid endpoint');
  }
};

router.get('/:endpoint', async (req, res) => {
  const { endpoint } = req.params;

  try {
    const result = await getSystemInfo(endpoint);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      error: `Failed to retrieve ${endpoint} information`,
      details: error.message,
    });
  }
});

module.exports = router;
