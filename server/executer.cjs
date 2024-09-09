const { exec } = require('child_process');

/**
 * Execute function with options.
 * Allows handling of stdout, stderr, and exit events with callbacks.
 */

const execCommand = async (command, options = {}) => {
    const { onData, onError, onClose, timeout = 0, ...execOptions } = options;

    // Create a new Promise using the native exec with added timeout option
    const child = exec(command, { timeout, ...execOptions });

    // Attach listeners for stdout and stderr if provided
    if (onData && typeof onData === 'function' && child.stdout) {
        child.stdout.on('data', (data) => onData(data));
    }

    if (onError && typeof onError === 'function' && child.stderr) {
        child.stderr.on('data', (data) => onError(data));
    }

    if (onClose && typeof onClose === 'function') {
        child.on('close', (code) => onClose(code));
    }

    // Use Promise to handle exec result
    return new Promise((resolve, reject) => {
        let stdout = '';
        let stderr = '';

        if (child.stdout) {
            child.stdout.on('data', (data) => {
                stdout += data;
            });
        }

        if (child.stderr) {
            child.stderr.on('data', (data) => {
                stderr += data;
            });
        }

        child.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Command failed with code ${code}: ${stderr}`));
            } else {
                resolve(stdout);
            }
        });

        child.on('error', (err) => reject(new Error(`Failed to execute command: ${err.message}`)));
    });
};

const executeCommand = (command, options = {}) => {
    return execCommand(command, { maxBuffer: 1024 * 1024 * 10, ...options });
};

const executeSudoCommand = (command, password) => {
    if (!password) {
        throw new Error("Password is required for sudo commands.");
    }
    return executeCommand(`echo ${password} | sudo -S ${command}`, { timeout: 5000 });
};

module.exports = {
    executeCommand,
    executeSudoCommand,
};
