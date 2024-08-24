//@utils/executer.js

import { exec } from "child_process";

export const executeCommand = (command, options = {}) => {
  return new Promise((resolve, reject) => {
    exec(
      command,
      { maxBuffer: 1024 * 1024 * 10, ...options },
      (error, stdout, stderr) => {
        if (error) {
          if (error.code === 5) {
            // If the error code is 5, resolve the stdout instead of rejecting
            resolve(stdout);
          } else {
            reject({ error, stderr });
          }
          return;
        }

        if (!stdout && !stderr) {
          resolve("Command executed successfully with no output.");
        } else {
          resolve(stdout || stderr);
        }
      },
    );
  });
};

// Function to execute a command with sudo privileges
export const executeSudoCommand = (command, password) => {
  return executeCommand(`echo ${password} | sudo -S ${command}`);
};
