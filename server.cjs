const express = require('express');
const next = require('next');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const crypto = require('crypto');
const pem = require('pem');

const { router: loginRoutes, isAuthenticated } = require("./server/auth.cjs");
const wireguardRoutes = require('./server/wireguard.cjs');
const updateRoutes = require('./server/update.cjs');
const storageRoutes = require('./server/storage.cjs');
const networkRoutes = require('./server/network.cjs');
const systemRoutes = require('./server/systemstatus.cjs');
const systemInfoRoutes = require('./server/systeminfo.cjs');
const powerRoutes = require('./server/power.cjs');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = express();

  // Session middleware to manage user sessions
  server.use(session({
    secret: crypto.randomBytes(64).toString('hex'),
    resave: false,
    saveUninitialized: false,
    store: new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    }),
    cookie: {
      secure: false, // Set to true if using HTTPS
      httpOnly: true,
      maxAge: 3600000,
      sameSite: 'Lax',
      path: '/',
    },
  }));

  server.use(express.json());

  // Apply the isAuthenticated middleware to all other /api routes
  server.use('/api', (req, res, next) => {
    if (req.path !== '/login' && req.path !== '/logout') {
      isAuthenticated(req, res, next);
    } else {
      next();
    }
  });

  server.use("/api/wireguard", wireguardRoutes);
  server.use("/api", loginRoutes);
  server.use("/api/updates", updateRoutes);
  server.use("/api", storageRoutes);
  server.use("/api", networkRoutes);
  server.use("/api/system-status", systemRoutes);
  server.use('/api/systeminfo', systemInfoRoutes);
  server.use('/api', powerRoutes);

  // Handle all other routes with Next.js
  server.all('*', (req, res) => { return handle(req, res); });

  // Start server with HTTPS
  pem.createCertificate({ days: 365, selfSigned: true }, (err, keys) => {
    if (err) {
      console.error('Error generating self-signed certificate', err);
      process.exit(1);
      return;
    }
    const https = require('https');
    https.createServer({ key: keys.serviceKey, cert: keys.certificate }, server).listen(3000, (err) => {
      if (err) throw err;
      console.log('> Ready on https://localhost:3000');
    });
  });
});
