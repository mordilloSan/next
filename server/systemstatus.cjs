//systemstatus.cjs

const express = require('express');
const { executeCommand } = require('./executer.cjs');

const router = express.Router();
const serviceDescriptionCache = new Map(); // Cache for descriptions

// Helper to fetch service description with cache
async function getServiceDescription(service) {
    if (serviceDescriptionCache.has(service)) {
        return serviceDescriptionCache.get(service);
    }
    const command = `systemctl show ${service} --property=Description`;
    try {
        const result = await executeCommand(command);
        const description = result.split('=')[1]?.trim() || 'No description available';
        serviceDescriptionCache.set(service, description);
        return description;
    } catch (error) {
        console.error(`Error getting description for ${service}: ${error}`);
        return 'No description available';
    }
}

// Helper to parse service data
function parseServiceLine(line) {
    const parts = line.trim().match(/^(\S+)\s+(\S+)\s*(\S+)?$/);
    if (parts) {
        let [name, loadState, activeState] = parts.slice(1);
        name = name.replace(/\.service$/, '').replace(/@\.\service$/, '');
        return { name, loadState, activeState: activeState || 'N/A' };
    }
    return null;
}

// Helper to check is description is available
function isTemplatedService(serviceName) {
    return serviceName.includes('@') && !serviceName.includes('@.');
  }

// Route to list services
router.get('/services', async (req, res) => {
    try {
        const command = 'systemctl list-unit-files --type=service --all';
        const result = await executeCommand(command);
        const lines = result.split('\n').slice(1).filter(line => line.trim() !== '');

        const services = lines.map(parseServiceLine).filter(Boolean);
        const servicesToFetch = services.filter(service => !serviceDescriptionCache.has(service.name) && !isTemplatedService(service.name));

        if (servicesToFetch.length > 0) {
            await Promise.all(servicesToFetch.map(async (service) => {
                service.description = await getServiceDescription(service.name);
            }));
        }

        services.forEach(service => {
            service.description = serviceDescriptionCache.get(service.name);
        });

        res.json({ services });
    } catch (error) {
        console.error(`Error getting services: ${error}`);
        res.status(500).json({ error: `Failed to get services: ${error.message}` });
    }
});

// Route to get system status
router.get('/status', async (req, res) => {
    const cmd = `systemctl status | awk '/systemd:/ { exit } { print }'`;
    try {
        const result = await executeCommand(cmd);
        const status = result.split('\n').reduce((acc, line) => {
            if (line.includes('State:')) acc.state = line.split(':')[1].trim();
            if (line.includes('Units:')) acc.units = parseInt(line.split(':')[1], 10);
            if (line.includes('Jobs:')) acc.jobs = parseInt(line.split(':')[1], 10);
            if (line.includes('Failed:')) acc.failed = parseInt(line.split(':')[1], 10);
            if (line.includes('Since:')) acc.since = line.split('Since:')[1].trim();
            return acc;
        }, {});

        res.json(status);
    } catch (error) {
        console.error(`Error getting system status: ${error}`);
        res.status(500).json({ error: `Failed to get system status: ${error.message}` });
    }
});

// Route to get details for a specific service
router.get('/service/:name', async (req, res) => {
    const { name: serviceName } = req.params;
    try {
        const command = `systemctl show ${serviceName} --no-page`;
        const result = await executeCommand(command);
        const details = result.split('\n').reduce((acc, line) => {
            const [key, value] = line.split('=');
            acc[key] = value;
            return acc;
        }, {});

        res.json(details);
    } catch (error) {
        console.error(`Error getting service details for ${serviceName}: ${error}`);
        res.status(500).json({ error: `Failed to get details for service ${serviceName}: ${error.message}` });
    }
});

// Add a new function to cache services when the server starts
async function cacheServiceDescriptions() {
    try {
        const command = 'systemctl list-unit-files --type=service --all';
        const result = await executeCommand(command);
        const lines = result.split('\n').slice(1).filter(line => line.trim() !== '');

        const services = lines.map(parseServiceLine).filter(Boolean);
        const servicesToCache = services.filter(service => !isTemplatedService(service.name));

        await Promise.all(servicesToCache.map(async (service) => {
            const description = await getServiceDescription(service.name);
            serviceDescriptionCache.set(service.name, description);
        }));

        console.log('Service descriptions cached successfully.');
    } catch (error) {
        console.error(`Failed to cache service descriptions: ${error.message}`);
    }
}

module.exports = { router, cacheServiceDescriptions };