const { executeCommand } = require('./executer.cjs');

const regexPatterns = {
  device: /.*(acpitz|i2c|pci|isa).*/,
  adapter: /(Adapter:\s*)([A-Za-z0-9\-:.\s]*)/,
  voltage: /([A-Za-z0-9\+\.\s\_]*)\:\s*\+([0-9]*\.[0-9]*\s)V\s*(\(min\s\=\s*)?(\+[0-9]*\.[0-9]*)?\s?V?\,?\s?(max\s\=\s*)?(\+[0-9]*\.[0-9]*)?\s?V?\)?/,
  temperature: /([A-Za-z0-9\+\.\s\_]*)\:\s*(\+?\-?[0-9]*\.[0-9]*)°C\s*\((low\s*\=\s*)?(\+?\-?[0-9]*\.[0-9]*)?°?C?\,?\s*(high\s*\=\s*)?(\+?\-?[0-9]*\.[0-9]*)?°?C?\)?/,
  rpm: /([A-Za-z0-9\+\.\s\_]*)\:\s*([0-9]*)\sRPM\s*\(min\s*\=\s*([0-9]*)\sRPM\)/,
};

const matchLine = (line, regex) => line.match(regex);

const parseLine = (line, currentDevice, currentAdapter, output) => {
  const voltage = matchLine(line, regexPatterns.voltage);
  if (voltage) {
    output[currentDevice][currentAdapter][voltage[1].trim()] = {
      type: 'voltage',
      value: parseFloat(voltage[2]),
      min: voltage[4] ? parseFloat(voltage[4]) : undefined,
      max: voltage[6] ? parseFloat(voltage[6]) : undefined,
    };
    return;
  }

  const temperature = matchLine(line, regexPatterns.temperature);
  if (temperature) {
    output[currentDevice][currentAdapter][temperature[1].trim()] = {
      type: 'temperature',
      value: parseFloat(temperature[2]),
      low: temperature[4] ? parseFloat(temperature[4]) : undefined,
      high: temperature[6] ? parseFloat(temperature[6]) : undefined,
    };
    return;
  }

  const rpm = matchLine(line, regexPatterns.rpm);
  if (rpm) {
    output[currentDevice][currentAdapter][rpm[1].trim()] = {
      type: 'rpm',
      value: parseInt(rpm[2]),
      min: rpm[3] ? parseInt(rpm[3]) : undefined,
    };
  }
};

const parser = function (sensors_output) {
  const lines = sensors_output.toString().split("\n").map(line => line.trim()).filter(line => line);
  const output = {};
  let currentDevice = '';
  let currentAdapter = '';

  lines.forEach((line) => {
    const device = matchLine(line, regexPatterns.device);
    if (device) {
      currentDevice = device[0];
      output[currentDevice] = output[currentDevice] || {};
      return;
    }

    const adapter = matchLine(line, regexPatterns.adapter);
    if (adapter) {
      currentAdapter = adapter[2].trim();
      output[currentDevice][currentAdapter] = output[currentDevice][currentAdapter] || {};
      return;
    }

    if (currentDevice && currentAdapter) {
      parseLine(line, currentDevice, currentAdapter, output);
    }
  });

  return output;
};

async function sensors() {
  try {
    const stdout = await executeCommand('sensors');
    return { data: parser(stdout), error: null };
  } catch (error) {
    console.error("Execution error:", error);
    return { data: null, error };
  }
}

async function sensorsInstalled() {
  try {
    await executeCommand('sensors');
    return true;
  } catch {
    return false;
  }
}

module.exports = { sensors, sensorsInstalled };
