const express = require('express');
const { executeCommand } = require('./executer.cjs'); // Assuming your custom command executor is in this file

const router = express.Router();

// Simple in-memory cache for service descriptions
let cachedServiceDescriptions = {};

// Helper function to get service details including description
async function getServiceDetails(service) {
    if (cachedServiceDescriptions[service]) {
        return cachedServiceDescriptions[service];
    }

    const command = `systemctl show ${service} --property=Description`;
    try {
        const result = await executeCommand(command);
        const description = result.split('=')[1]?.trim() || 'No description available';
        cachedServiceDescriptions[service] = description; // Cache the description
        return description;
    } catch (error) {
        console.error(`Failed to get details for service ${service}: ${error}`);
        return 'No description available';
    }
}

// Route to get the list of services
router.get('/services', async (req, res) => {
    const command = 'systemctl list-unit-files --type=service --all';

    try {
        const result = await executeCommand(command);
        const lines = result.split('\n').slice(1).filter((line) => line.trim() !== '');

        const services = lines.map((line) => {
            const parts = line.trim().match(/^(\S+)\s+(\S+)\s*(\S+)?$/);
            if (parts) {
                let [name, loadState, activeState] = parts.slice(1);
                if (name.endsWith('@.service')) {
                    name = name.slice(0, -9);
                } else if (name.endsWith('.service')) {
                    name = name.slice(0, -8);
                }
                return {
                    name,
                    loadState,
                    activeState: activeState || 'N/A',
                    description: cachedServiceDescriptions[name] || '',  // Check cache
                };
            } else {
                return null;
            }
        }).filter(service => service !== null);

        const servicesToFetch = services.filter(service => !service.description);

        if (servicesToFetch.length > 0) {
            await Promise.all(
                servicesToFetch.map(async (service) => {
                    service.description = await getServiceDetails(service.name);
                })
            );
        }

        res.json({ services });
    } catch (error) {
        console.error(`Failed to get system services: ${error}`);
        res.status(500).json({ error: `Failed to get system services: ${error.message}` });
    }
});

// Route to get the system status
router.get('/status', async (req, res) => {
    const cmd = `systemctl status | awk '/systemd:/ { exit } { print }'`;
    try {
        const result = await executeCommand(cmd);
        const lines = result.split('\n');
        const status = {
            state: '',
            units: 0,
            jobs: 0,
            failed: 0,
            since: '',
        };

        lines.forEach((line) => {
            if (line.includes('State:')) {
                status.state = line.split(':')[1].trim();
            } else if (line.includes('Units:')) {
                status.units = parseInt(line.split(':')[1].trim().split(' ')[0], 10);
            } else if (line.includes('Jobs:')) {
                status.jobs = parseInt(line.split(':')[1].trim().split(' ')[0], 10);
            } else if (line.includes('Failed:')) {
                status.failed = parseInt(line.split(':')[1].trim().split(' ')[0], 10);
            } else if (line.includes('Since:')) {
                status.since = line.split('Since:')[1].trim();
            }
        });

        res.json(status);
    } catch (error) {
        console.error(`Failed to get system status: ${error}`);
        res.status(500).json({ error: `Failed to get system status: ${error.message}` });
    }
});

// Route to get details of a specific service
router.get('/service/:name', async (req, res) => {
    const serviceName = req.params.name;
    const command = `systemctl show ${serviceName} --no-page`;

    try {
        const result = await executeCommand(command);
        const details = result.split('\n').reduce((acc, line) => {
            const [key, value] = line.split('=');
            acc[key] = value;
            return acc;
        }, {});

        res.json(details);
    } catch (error) {
        console.error(`Failed to get details for service ${serviceName}: ${error}`);
        res.status(500).json({ error: `Failed to get details for service ${serviceName}: ${error.message}` });
    }
});

module.exports = router;
