const express = require("express");
const app = express.Router();
const Docker = require("dockerode");
const docker = new Docker({ socketPath: "/var/run/docker.sock" });
const path = require("path");
const fs = require("fs");

const iconsDirectory = path.join(__dirname, "..", "icons");
let knownContainerNames = new Set();

app.use("/icons", express.static(iconsDirectory));

if (!fs.existsSync(iconsDirectory)) {
  fs.mkdirSync(iconsDirectory);
}

async function downloadIcon(containerName) {
  try {
    const iconName = containerName.replace(/^\//, "").replace(/_/g, "-").toLowerCase();
    const iconPath = path.join(iconsDirectory, `${iconName}.png`);
    if (fs.existsSync(iconPath)) {
      return;
    }
    const iconUrl = `https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/${iconName}.png`;
    const response = await fetch(iconUrl);
    if (!response.ok) {
      throw new Error(response.statusText);
    }
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(iconPath, Buffer.from(buffer));
  } catch (error) {
  }
}

async function downloadIcons() {
  try {
    const containers = await docker.listContainers({ all: true });
    for (const container of containers) {
      const containerName = container.Names[0].substring(1);
      knownContainerNames.add(containerName);
      await downloadIcon(containerName);
    }
    console.log("Docker containers icons cached successfully.");
  } catch (error) {
    console.error("Failed to download all icons:", error.message);
  }
}

// API endpoint to download icons for all containers
app.get("/download-icons", async (req, res) => {
  try {
    await downloadIcons();
    res.status(200).send("All possible icons downloaded");
  } catch (error) {
    console.error("Failed to download icons:", error.message);
    res.status(500).json({ error: "Failed to download icons" });
  }
});

// Docker API endpoints
app.get("/containers", async (req, res) => {
  try {
    const containers = await docker.listContainers({ all: true });
    res.json(containers);
  } catch (error) {
    console.error("Failed to list Docker containers:", error.message);
    res.status(500).json({
      error: "Failed to list Docker containers",
      details: error.message,
    });
  }
});

app.post("/containers/:id/start", async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    await container.start();
    res.status(204).send(); // No Content response
  } catch (error) {
    console.error(`Failed to start Docker container ${req.params.id}:`, error.message);
    res.status(500).json({
      error: `Failed to start Docker container ${req.params.id}`,
      details: error.message,
    });
  }
});

app.post("/containers/:id/stop", async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    await container.stop();
    res.status(204).send(); // No Content response
  } catch (error) {
    console.error(`Failed to stop Docker container ${req.params.id}:`, error.message);
    res.status(500).json({
      error: `Failed to stop Docker container ${req.params.id}`,
      details: error.message,
    });
  }
});

async function fetchDockerInfo() {
  try {
    const containers = await docker.listContainers({ all: true });
    return containers.map((container) => ({
      id: container.Id,
      name: container.Names.join(", ").substring(1),
      image: container.Image,
      state: container.State,
      status: container.Status,
      // Include any other container details you need
    }));
  } catch (error) {
    console.error("Failed to fetch Docker containers info:", error.message);
    throw error;
  }
}

module.exports = { fetchDockerInfo, downloadIcons, app };
