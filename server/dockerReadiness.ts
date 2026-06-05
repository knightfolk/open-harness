/**
 * Docker + Docker MCP readiness check
 * Probes the local machine for Docker installation, daemon state, and the
 * Docker MCP Toolkit (`docker mcp ...`) so onboarding and Settings can give
 * a single shared "ready / not ready / partial" verdict.
 */
import { execFile } from 'child_process';
import { promisify } from 'util';
import { dockerDesktopEnv } from './dockerDesktopEnv';

const exec = promisify(execFile);
const TIMEOUT_MS = 4000;

async function tryExec(file: string, args: string[]): Promise<{ ok: boolean; stdout: string; error?: string }> {
  try {
    const { stdout } = await exec(file, args, { timeout: TIMEOUT_MS, maxBuffer: 1 << 20, env: dockerDesktopEnv() });
    return { ok: true, stdout: String(stdout || '').trim() };
  } catch (err: any) {
    return { ok: false, stdout: '', error: err?.stderr?.toString()?.trim() || err?.message || 'failed' };
  }
}

export interface DockerReadiness {
  dockerInstalled: boolean;
  daemonRunning: boolean;
  dockerMcpAvailable: boolean;
  profileReady: boolean;
  version?: string;
  serverVersion?: string;
  mcpVersion?: string;
  profiles: string[];
  hints: string[];
  checkedAt: string;
}

export async function checkDockerReadiness(): Promise<DockerReadiness> {
  const hints: string[] = [];
  const dockerWhich = await tryExec('which', ['docker']);
  const dockerInstalled = dockerWhich.ok;
  if (!dockerInstalled) {
    hints.push('Docker Desktop is not installed. Install it from https://www.docker.com/products/docker-desktop to enable MCP tools.');
    return {
      dockerInstalled: false,
      daemonRunning: false,
      dockerMcpAvailable: false,
      profileReady: false,
      profiles: [],
      hints,
      checkedAt: new Date().toISOString(),
    };
  }

  const versionRes = await tryExec('docker', ['--version']);
  const version = versionRes.ok ? versionRes.stdout.replace(/^Docker version\s+/i, '').trim() : undefined;

  const infoRes = await tryExec('docker', ['info']);
  const daemonRunning = infoRes.ok;
  if (!daemonRunning) {
    hints.push('Docker is installed but the daemon is not running. Open Docker Desktop and wait for the whale icon to settle, then click Retry.');
  }

  const mcpVersionRes = await tryExec('docker', ['mcp', '--version']);
  const dockerMcpAvailable = mcpVersionRes.ok;
  const mcpVersion = mcpVersionRes.ok ? mcpVersionRes.stdout : undefined;
  if (!dockerMcpAvailable) {
    hints.push('Docker MCP Toolkit is not installed. Run `docker mcp init` (Docker Desktop -> MCP Toolkit -> Enable) to install the gateway and curated servers.');
  }

  const profileRes = await tryExec('docker', ['mcp', 'profile', 'list']);
  let profiles: string[] = [];
  let profileReady = false;
  if (profileRes.ok) {
    profiles = profileRes.stdout
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !/^(-+|\s*ID\s+Name|NAME\b)/i.test(l));
    profileReady = profiles.some((p) => /ai[-_ ]?coding/i.test(p));
    if (!profileReady) {
      hints.push('No `ai_coding` MCP profile found. Open Docker Desktop -> MCP Toolkit -> Profiles and enable one that includes AI coding tools.');
    }
  } else {
    hints.push('Could not list Docker MCP profiles. Make sure the Docker MCP Toolkit plugin is enabled.');
  }

  let serverVersion: string | undefined;
  if (daemonRunning) {
    const sv = await tryExec('docker', ['version', '--format', '{{.Server.Version}}']);
    if (sv.ok) serverVersion = sv.stdout;
  }

  return {
    dockerInstalled: true,
    daemonRunning,
    dockerMcpAvailable,
    profileReady,
    version,
    serverVersion,
    mcpVersion,
    profiles,
    hints,
    checkedAt: new Date().toISOString(),
  };
}
