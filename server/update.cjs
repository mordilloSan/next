const express = require('express');
const os = require('os');
const fs = require('fs');
const { executeCommand, executeSudoCommand } = require('./executer.cjs');
const config = require('./config.cjs');
const server = express.Router();

// Constants

// Cache for update history
let updateHistoryCache = null;
let lastUpdateTime = null;
const NA = "N/A";

// Cache package manager info for reuse
let packageManagerCache = null;

// Cache for changelogs with timestamps
let changelogCache = {};

// Package managers
const packageManagers = {
  ubuntu: { pm: "apt list --upgradable 2>/dev/null", historyCmd: "zcat /var/log/apt/history.log.* ; cat /var/log/apt/history.log", changelogCmd: "apt-get changelog" },
  debian: this.ubuntu,
  fedora: { pm: "dnf", historyCmd: "dnf history info", changelogCmd: "dnf changelog" },
  centos: this.fedora,
  rhel: this.fedora,
  arch: { pm: "pacman", historyCmd: "cat /var/log/pacman.log | grep -i 'installed\\|upgraded'", changelogCmd: "pacman -Qc" }
};

// Optimized getPackageManager to use caching
const getPackageManager = () => {
  if (packageManagerCache) return packageManagerCache;

  try {
    const platform = os.platform();
    if (platform !== 'linux') throw new Error("Unsupported operating system");

    const osRelease = fs.readFileSync(config.OS_RELEASE_PATH, "utf8");
    const idLine = osRelease.split("\n").find((line) => line.startsWith("ID="));
    const distro = idLine ? idLine.split("=")[1].replace(/"/g, "") : null;

    if (!packageManagers[distro]) throw new Error("Unsupported Linux distribution");

    packageManagerCache = packageManagers[distro];
    return packageManagerCache;
  } catch (error) {
    console.error("Failed to determine package manager:", error);
    throw error;
  }
};

// Helper function to fetch changelog (with caching and TTL)
async function fetchChangelog(packageName, newVersion, changelogCmd) {
  const cacheKey = `${packageName}:${newVersion}`;

  // Check if cache exists and is still valid (within TTL)
  const cachedEntry = changelogCache[cacheKey];
  const now = Date.now();

  if (cachedEntry && (now - cachedEntry.timestamp < config.CACHE_TTL)) {
    return cachedEntry.data;
  }

  try {
    const changelogCommand = `${changelogCmd} ${packageName} | awk -v version="${newVersion}" '
                            /^\\S+ \\([0-9][^)]*\\)/ {
                                if (found) exit;
                                if (index($2, version)) found=1
                            }
                            found'`;
    const changelogOutput = await executeCommand(changelogCommand);
    const changelog = changelogOutput.split('\n').filter(line => line.trim() !== "");

    // Update cache with new changelog and timestamp
    changelogCache[cacheKey] = {
      data: changelog,
      timestamp: now,
    };

    return changelog;
  } catch (error) {
    console.error(`Failed to fetch changelog for ${packageName}: ${error.message}`);
    return [NA];
  }
}

// Parse package details more efficiently
function parsePackageLine(line) {
  const [packageDetails, versionDetails] = line.split(" [upgradable from: ");
  return {
    packageName: packageDetails.split("/")[0],
    newVersion: packageDetails.split(" ").slice(-2)[0],
    currentVersion: versionDetails.replace("]", "")
  };
}

// Route to check for upgradable packages
server.get('/status', async (req, res) => {
  try {
    const { pm, changelogCmd } = getPackageManager();
    const result = await executeCommand(pm);
    const packageGroups = result.split("\n").slice(1).filter(line => line.trim());

    const updatesAvailable = await Promise.all(packageGroups.map(async (line) => {
      const { packageName, newVersion, currentVersion } = parsePackageLine(line);
      const changelog = await fetchChangelog(packageName, newVersion, changelogCmd);

      return {
        package: packageName,
        currentVersion,
        availableVersion: newVersion,
        changelog,
        cves: [], // Placeholder for future enhancement
        lps: [],  // Placeholder for future enhancement
      };
    }));

    res.json({
      message: updatesAvailable.length > 0 ? "Updates Available" : "System is up to date",
      updates: updatesAvailable,
      currentTime: Date.now(),
    });
  } catch (err) {
    console.error(`Failed to check for upgradable packages: ${err.message}`);
    res.status(500).json({
      error: "Failed to check for upgradable packages",
      details: err.message,
    });
  }
});

// Function to fetch and process update history, with caching
async function cacheUpdateHistory(forceRefresh = false) {
  const now = Date.now();

  // If cache exists and is still valid, return cached data
  if (!forceRefresh && updateHistoryCache && (now - lastUpdateTime < config.CACHE_TTL)) {
    return updateHistoryCache;
  }

  try {
    const { historyCmd } = getPackageManager();  // Reuse the getPackageManager function
    const result = await executeCommand(historyCmd);

    // Process the result into a structured format
    const historyByDate = result
      .split("Start-Date:")
      .filter(Boolean)
      .reduce((acc, entry) => {
        const date = entry.match(/(\d{4}-\d{2}-\d{2})/)?.[0] || "unknown";
        const upgrades = entry.match(/Upgrade: (.+?)(?=End-Date|Start-Date)/s)?.[1]
          ?.replace(/:.*?\(.*?\)/g, "")
          .trim()
          .split(", ")
          .map(pkg => pkg.trim()) || [];

        acc[date] = acc[date] || { upgrades: [] };
        acc[date].upgrades.push(...upgrades.map(pkg => ({ package: pkg })));
        return acc;
      }, {});

    // Sort the history by date
    const sortedHistory = Object.keys(historyByDate)
      .filter(date => historyByDate[date].upgrades.length > 0)
      .sort((a, b) => new Date(b) - new Date(a))
      .map(date => ({ date, upgrades: historyByDate[date].upgrades }));

    // Cache the fetched history
    updateHistoryCache = sortedHistory;
    lastUpdateTime = now;
    console.log('Update history cached successfully.');
    return sortedHistory; // Return the processed update history
  } catch (err) {
    console.error("Failed to fetch update history:", err);
    throw new Error('Failed to fetch update history');
  }
}

// Route to fetch update history
server.get('/update-history', async (req, res) => {
  try {
    const updateHistory = await cacheUpdateHistory(); // This will serve cached data if available
    res.json(updateHistory);
  } catch (err) {
    console.error("Failed to fetch update history:", err);
    res.status(500).json({
      error: "Failed to fetch update history",
      details: err.message,
    });
  }
});

// Existing route to handle package updates
server.post('/update-package', async (req, res) => {
  const { packageName } = req.body;
  const password = req.session?.user?.password;

  if (!packageName) return res.status(400).json({ message: 'Package name is missing' });
  if (!password) return res.status(400).json({ message: 'Session information is missing' });

  try {
    const output = await executeSudoCommand(`apt-get -y upgrade ${packageName}`, password);
    res.json({ message: `Package ${packageName} updated successfully`, output });
  } catch (error) {
    console.error(`Error updating package ${packageName}:`, error);
    res.status(500).json({ message: `Failed to update package ${packageName}`, error: error.stderr || error.message });
  }
});

module.exports = { server, cacheUpdateHistory };
