import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export function getDockerDesktopHome(): string {
  const user = process.env.USER || process.env.LOGNAME;
  if (user) {
    const macHome = join('/Users', user);
    if (existsSync(macHome)) return macHome;
  }
  return homedir();
}

export function dockerDesktopEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  const home = getDockerDesktopHome();
  env.HOME = home;
  env.DOCKER_CONFIG = join(home, '.docker');
  env.DOCKER_HOST = `unix://${join(home, '.docker', 'run', 'docker.sock')}`;
  delete env.XDG_CONFIG_HOME;
  delete env.XDG_DATA_HOME;
  delete env.XDG_STATE_HOME;
  delete env.XDG_CACHE_HOME;
  return env;
}
