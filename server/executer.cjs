const util = require('util');
const { exec: childExec } = require('child_process');
const execute = util.promisify(childExec);

/**
 * exec function with options.
 * Allows handling of stdout, stderr, and exit events with callbacks.
 */

const exec = async (command, options = {}) => {
    const { onData, onError, onClose, ...execOptions } = options;

    const promise = execute(command, execOptions);
    const child = promise.child;

    // Attach listeners for stdout and stderr if provided
    if (onData && typeof onData === 'function') {
        child.stdout.on('data', (data) => onData(data));
    }

    if (onError && typeof onError === 'function') {
        child.stderr.on('data', (data) => onError(data));
    }

    if (onClose && typeof onClose === 'function') {
        child.on('close', (code) => onClose(code));
    }

    // Await the completion of the command
    const { stdout, stderr } = await promise;

    if (stderr) {
        throw new Error(stderr);
    }

    return stdout;
};

const executeCommand = (command, options = {}) => {
    return exec(command, { maxBuffer: 1024 * 1024 * 10, ...options });
};

const executeSudoCommand = (command, password) => {
    return executeCommand(`echo ${password} | sudo -S ${command}`);
};

module.exports = {
    executeCommand,
    executeSudoCommand,
};
