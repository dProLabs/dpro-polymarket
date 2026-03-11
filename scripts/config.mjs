import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { CONFIG_DIR, CONFIG_FILE } from './constants.mjs';

const configDir = join(homedir(), CONFIG_DIR);
const configPath = join(configDir, CONFIG_FILE);

const DEFAULTS = {
  defaultAccountAlias: null,
  accounts: [],
};

let cachedConfig = null;

function ensureDir() {
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
}

function atomicWriteJson(filePath, data) {
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  renameSync(tmpPath, filePath);
}

export function loadConfig() {
  if (cachedConfig) return cachedConfig;
  ensureDir();
  if (existsSync(configPath)) {
    try {
      cachedConfig = JSON.parse(readFileSync(configPath, 'utf8'));
      return cachedConfig;
    } catch {
      // corrupted — use defaults
    }
  }
  cachedConfig = { ...DEFAULTS };
  return cachedConfig;
}

export function saveConfig(config) {
  ensureDir();
  cachedConfig = config;
  atomicWriteJson(configPath, config);
}

export function getConfigDir() {
  return configDir;
}

export function resetConfigCache() {
  cachedConfig = null;
}
