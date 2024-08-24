const express = require('express');
const os = require('os');
const fs = require('fs');
const { executeCommand, executeSudoCommand } = require('./executer.cjs');

const server = express.Router();

// Helper function to determine the package manager and history command
const getPackageManager = () => {
    try {
        const platform = os.platform();
        if (platform === "linux") {
            const osRelease = fs.readFileSync("/etc/os-release", "utf8");
            const idLine = osRelease.split("\n").find((line) => line.startsWith("ID="));
            const id = idLine ? idLine.split("=")[1].replace(/"/g, "") : null;
            if (!id) throw new Error("Unable to determine Linux distribution");

            if (id === "ubuntu" || id === "debian") {
                return {
                    pm: "apt list --upgradable 2>/dev/null",
                    historyCmd: "zcat /var/log/apt/history.log.* ; cat /var/log/apt/history.log",
                    changelogCmd: "apt-get changelog",
                };
            } else if (id === "fedora" || id === "centos" || id === "rhel") {
                return {
                    pm: "dnf",
                    historyCmd: "dnf history info",
                    changelogCmd: "dnf changelog",
                };
            } else if (id === "arch") {
                return {
                    pm: "pacman",
                    historyCmd: "cat /var/log/pacman.log | grep -i 'installed\\|upgraded'",
                    changelogCmd: "pacman -Qc",
                };
            } else {
                throw new Error("Unsupported Linux distribution");
            }
        } else {
            throw new Error("Unsupported operating system");
        }
    } catch (error) {
        console.error("Failed to determine package manager and history command:", error);
        throw error;
    }
}

// Route to check for upgradable packages
server.get('/status', async (req, res) => {
    try {
        const { pm } = getPackageManager();
        const result = await executeCommand(pm);
        const lines = result.split("\n");

        const packageGroups = lines.slice(1).filter((line) => line.trim());

        const updatesAvailable = await Promise.all(
            packageGroups.map(async (line) => {
                const [packageDetails, versionDetails] = line.split(" [upgradable from: ");
                const packageName = packageDetails.split("/")[0];
                const [newVersion] = packageDetails.split(" ").slice(-2);
                const currentVersion = versionDetails.replace("]", "");

                const { changelogCmd } = getPackageManager();
                let updateDetails = { changelog: ["N/A"], cves: [], lps: [] };

                try {
                    const changelogCommand = `${changelogCmd} ${packageName} | awk -v version="${newVersion}" '
                              /^\\S+ \\([0-9][^)]*\\)/ {
                                  if (found) exit;
                                  if (index($2, version)) found=1
                              }
                              found'`;
                    const changelogOutput = await executeCommand(changelogCommand);
                    updateDetails.changelog = changelogOutput.split('\n').filter(line => line.trim() !== "");
                } catch (error) {
                    console.error(`Failed to fetch changelog for package ${packageName}: ${error.message}`);
                }

                return {
                    package: packageName,
                    currentVersion,
                    availableVersion: newVersion,
                    changelog: updateDetails.changelog || ["N/A"],
                    cves: updateDetails.cves || [],
                    lps: updateDetails.lps || [],
                };
            })
        );

        return res.json({
            message: updatesAvailable.length > 0 ? "Updates Available" : "System is up to date",
            updates: updatesAvailable,
            currentTime: Date.now(),
        });
    } catch (err) {
        console.error(`Failed to check for upgradable packages: ${err.message}`);
        return res.status(500).json({
            error: "Failed to check for upgradable packages",
            details: err.message,
        });
    }
});

// Route to fetch update history
server.get('/update-history', async (req, res) => {
    try {
        const { historyCmd } = getPackageManager();
        const result = await executeCommand(historyCmd);

        const historyByDate = result
            .split("Start-Date:")
            .filter(Boolean)
            .reduce((acc, entry) => {
                const dateMatch = entry.match(/(\d{4}-\d{2}-\d{2})/);
                const date = dateMatch ? dateMatch[0] : "unknown";
                const packages = [];

                const upgradeMatch = entry.match(/Upgrade: (.+?)(?=End-Date|Start-Date)/s);
                if (upgradeMatch) {
                    let upgradeText = upgradeMatch[1];
                    upgradeText = upgradeText.replace(/:.*?\(.*?\)/g, "").trim();
                    packages.push(...upgradeText.split(", ").map((pkg) => pkg.trim()));
                }

                if (!acc[date]) {
                    acc[date] = { upgrades: [] };
                }
                acc[date].upgrades.push(...packages.map((pkg) => ({ package: pkg })));

                return acc;
            }, {});

        const sortedHistory = Object.keys(historyByDate)
            .filter((date) => historyByDate[date].upgrades.length > 0)
            .sort((a, b) => new Date(b) - new Date(a))
            .map((date) => ({ date, upgrades: historyByDate[date].upgrades }));

        return res.json(sortedHistory);
    } catch (err) {
        console.error("Failed to fetch update history:", err);
        return res.status(500).json({
            error: "Failed to fetch update history",
            details: err.message,
        });
    }
});

// Existing route to handle package updates
server.post('/update-package', async (req, res) => {
    const { packageName } = req.body;
    const { user } = req.session;
    const password = user?.password;

    if (!packageName) {
        return res.status(400).json({ message: 'Package name is missing' });
    }
    if (!password) {
        return res.status(400).json({ message: 'Session information is missing' });
    }

    try {
        const output = await executeSudoCommand(`apt-get -y upgrade ${packageName}`, password);
        return res.json({ message: `Package ${packageName} updated successfully`, output });
    } catch (error) {
        console.error(`Error updating package ${packageName}:`, error);
        return res.status(500).json({ message: `Failed to update package ${packageName}`, error: error.stderr || error.message });
    }
});

module.exports = server;
