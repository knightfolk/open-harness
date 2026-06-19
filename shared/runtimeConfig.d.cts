export interface RuntimeConfig {
  serverPort: number;
  vitePort: number;
  listenHost: string;
  serverOrigin: string;
  viteOrigin: string;
  uiOrigin: string;
  allowedAppOrigins: string[];
}

export const DEFAULT_SERVER_PORT: number;
export const DEFAULT_VITE_PORT: number;
export const DEFAULT_LISTEN_HOST: string;
export function getRuntimeConfig(env?: NodeJS.ProcessEnv): RuntimeConfig;
export function parsePort(value: unknown, fallback: number): number;
