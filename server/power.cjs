const express = require('express');
const { executeSudoCommand } = require('./executer.cjs');

const router = express.Router();

// Route for shutting down the system
router.post('/shutdown', (req, res) => {
    const { user } = req.session;
    const password = user?.password;
    try {
        executeSudoCommand('shutdown -h now', password);
    } catch (error) {
        console.error('Error shutting down the system:', error);
        res.status(500).json({ error: 'Failed to shut down the system.' });
    }
});

// Route for restarting the system
router.post('/reboot', (req, res) => {
    const { user } = req.session;
    const password = user?.password;
    try {
        executeSudoCommand('reboot now', password);
    } catch (error) {
        console.error('Error restarting the system:', error);
        res.status(500).json({ error: 'Failed to restart the system.' });
    }
});

module.exports = router;