const express = require('express');
const { executeCommand } = require('./executer.cjs');

const router = express.Router();

// Helper function to validate POST data
function validateMountRequest(body) {
    const errors = [];

    if (!['nfs', 'samba'].includes(body.type)) {
        errors.push({ msg: 'Invalid mount type', param: 'type' });
    }

    if (!body.details?.source) {
        errors.push({ msg: 'Source is required', param: 'details.source' });
    }

    if (!body.details?.target) {
        errors.push({ msg: 'Target is required', param: 'details.target' });
    }

    if (!body.details?.folder) {
        errors.push({ msg: 'Folder is required', param: 'details.folder' });
    }

    if (body.type === 'samba' && (!body.details?.username || !body.details?.password)) {
        errors.push({ msg: 'Username and password are required for Samba', param: 'details.username/password' });
    }

    return errors;
}

// Route to handle GET /filesystems
router.get('/filesystems', async (req, res) => {
    try {
        const output = await executeCommand('df -h -T');
        const lines = output.trim().split('\n');
        lines.shift(); // Remove header line

        const filesystems = lines.map(line => {
            const columns = line.split(/\s+/);
            return {
                Filesystem: columns[0],
                Type: columns[1],
                Size: columns[2],
                Used: columns[3],
                Available: columns[4],
                UsePercentage: columns[5],
                MountedOn: columns[6]
            };
        });

        res.json(filesystems);
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

// Route to handle POST /mount
router.post('/mount', async (req, res) => {
    const body = req.body;
    const errors = validateMountRequest(body);

    if (errors.length > 0) {
        return res.status(400).json({ errors });
    }

    const { type, details } = body;
    let mountCommand;

    switch (type) {
        case 'nfs':
            // For NFS: mount -t nfs source:/folder target
            mountCommand = `mount -t nfs ${details.source}:${details.folder} ${details.target}`;
            break;
        case 'samba':
            // For Samba: mount -t cifs //source/folder target -o username=user,password=pass
            mountCommand = `mount -t cifs //${details.source}/${details.folder} ${details.target} -o username=${details.username},password=${details.password}`;
            break;
        default:
            return res.status(400).json({ error: 'Invalid mount type or missing details' });
    }

    try {
        const mountResult = await executeCommand(mountCommand);
        res.json({ message: 'Mount successful', details: mountResult.trim() });
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

module.exports = router;
