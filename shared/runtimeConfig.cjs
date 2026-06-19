'use strict';

const DEFAULT_SERVER_PORT = 3001;
const DEFAULT_VITE_PORT = 5173;
const DEFAULT_LISTEN_HOST = '127.0.0.1';

function parsePort(value, fallback) {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  const port = Number(raw);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : fallback;
}

function loopbackOrigin(port, host = '127.0.0.1') {
  return `http://${host}:${port}`;
}

function getRuntimeConfig(env = process.env) {
  const serverPort = parsePort(env.OPENHARNESS_SERVER_PORT || env.PORT, DEFAULT_SERVER_PORT);
  const vitePort = parsePort(env.OPENHARNESS_VITE_PORT || env.VITE_PORT, DEFAULT_VITE_PORT);
  const listenHost = env.OPENHARNESS_LISTEN_HOST || env.OPENHARNESS_BIND_HOST || DEFAULT_LISTEN_HOST;
  const serverOrigin = loopbackOrigin(serverPort);
  const viteOrigin = loopbackOrigin(vitePort);
  const uiOrigin = env.OPENHARNESS_UI_URL || `http://localhost:${vitePort}`;
  const allowedAppOrigins = [
    serverOrigin,
    `http://localhost:${serverPort}`,
    viteOrigin,
    `http://localhost:${vitePort}`,
    `http://host.docker.internal:${serverPort}`,
    `http://host.docker.internal:${vitePort}`,
  ];

  return {
    serverPort,
    vitePort,
    listenHost,
    serverOrigin,
    viteOrigin,
    uiOrigin,
    allowedAppOrigins,
  };
}

module.exports = {
  DEFAULT_SERVER_PORT,
  DEFAULT_VITE_PORT,
  DEFAULT_LISTEN_HOST,
  getRuntimeConfig,
  parsePort,
};
