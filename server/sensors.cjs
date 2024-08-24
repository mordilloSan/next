const { executeCommand } = require('./executer.cjs');

const rMatchDevice = new RegExp(".*(acpitz|i2c|pci|isa).*");
const rMatchAdapter = /(Adapter:\s*)([A-Za-z0-9\-:.\s]*)/;
const rMatchVoltage = /([A-Za-z0-9\+\.\s\_]*)\:\s*\+([0-9]*\.[0-9]*\s)V\s*(\(min\s\=\s*)?(\+[0-9]*\.[0-9]*)?\s?V?\,?\s?(max\s\=\s*)?(\+[0-9]*\.[0-9]*)?\s?V?\)?/;
const rMatchTemperature = /([A-Za-z0-9\+\.\s\_]*)\:\s*(\+?\-?[0-9]*\.[0-9]*)°C\s*\((low\s*\=\s*)?(\+?\-?[0-9]*\.[0-9]*)?°?C?\,?\s*(high\s*\=\s*)?(\+?\-?[0-9]*\.[0-9]*)?°?C?\)?/;
const rMatchRPM = /([A-Za-z0-9\+\.\s\_]*)\:\s*([0-9]*)\sRPM\s*\(min\s*\=\s*([0-9]*)\sRPM\)/;

const parser = function (sensors_output) {
    const raw_lines = sensors_output.toString().split("\n");
    const output = {};
    let current_device = '';
    let current_adapter = '';

    raw_lines.forEach(function (raw_line) {
        if (raw_line === '') return;
        raw_line = raw_line.trim();

        const device_matches = raw_line.match(rMatchDevice);
        if (device_matches !== null) {
            current_device = device_matches[0];
            output[current_device] = output[current_device] || {};
            return;
        }

        const adapter_matches = rMatchAdapter.exec(raw_line);
        if (adapter_matches !== null) {
            current_adapter = adapter_matches[2].trim();
            output[current_device][current_adapter] = output[current_device][current_adapter] || {};
            return;
        }

        if (current_device && current_adapter) {
            const voltage_matches = raw_line.match(rMatchVoltage);
            if (voltage_matches) {
                output[current_device][current_adapter][voltage_matches[1].trim()] = {
                    type: 'voltage',
                    name: voltage_matches[1].trim(),
                    value: parseFloat(voltage_matches[2]),
                    min: voltage_matches[4] ? parseFloat(voltage_matches[4]) : undefined,
                    max: voltage_matches[6] ? parseFloat(voltage_matches[6]) : undefined
                };
                return;
            }

            const temperature_matches = raw_line.match(rMatchTemperature);
            if (temperature_matches) {
                output[current_device][current_adapter][temperature_matches[1].trim()] = {
                    type: 'temperature',
                    name: temperature_matches[1].trim(),
                    value: parseFloat(temperature_matches[2]),
                    low: temperature_matches[4] ? parseFloat(temperature_matches[4]) : undefined,
                    high: temperature_matches[6] ? parseFloat(temperature_matches[6]) : undefined
                };
                return;
            }

            const rpm_matches = raw_line.match(rMatchRPM);
            if (rpm_matches) {
                output[current_device][current_adapter][rpm_matches[1].trim()] = {
                    type: 'rpm',
                    name: rpm_matches[1].trim(),
                    value: parseInt(rpm_matches[2]),
                    min: rpm_matches[3] ? parseInt(rpm_matches[3]) : undefined
                };
            }
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
    } catch (error) {
        return false;
    }
}

module.exports = {
    sensors,
    sensorsInstalled
};
