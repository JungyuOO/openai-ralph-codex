import os from 'node:os';
import path from 'node:path';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const pluginName = 'openai-ralph-codex';
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function resolveHomePluginPaths(homeDir = os.homedir()) {
  return {
    homeDir,
    sourcePluginDir: path.join(packageRoot, 'plugins', pluginName),
    targetPluginDir: path.join(homeDir, 'plugins', pluginName),
    marketplacePath: path.join(homeDir, '.agents', 'plugins', 'marketplace.json'),
    codexHooksPath: path.join(homeDir, '.codex', 'hooks.json'),
  };
}

export async function installHomePlugin(options = {}) {
  const installation = options.installation ?? 'INSTALLED_BY_DEFAULT';
  const authentication = options.authentication ?? 'ON_INSTALL';
  const category = options.category ?? 'Productivity';
  const paths = resolveHomePluginPaths(options.homeDir);

  if (!existsSync(paths.sourcePluginDir)) {
    throw new Error(`Missing source plugin directory: ${paths.sourcePluginDir}`);
  }

  await mkdir(path.dirname(paths.targetPluginDir), { recursive: true });
  await cp(paths.sourcePluginDir, paths.targetPluginDir, {
    recursive: true,
    force: true,
  });

  const marketplace = await loadMarketplace(paths.marketplacePath);
  const nextEntry = {
    name: pluginName,
    source: {
      source: 'local',
      path: `./plugins/${pluginName}`,
    },
    policy: {
      installation,
      authentication,
    },
    category,
  };

  const others = marketplace.plugins.filter((plugin) => plugin.name !== pluginName);
  marketplace.plugins = [...others, nextEntry];
  await mkdir(path.dirname(paths.marketplacePath), { recursive: true });
  await writeFile(paths.marketplacePath, JSON.stringify(marketplace, null, 2) + '\n', 'utf8');

  const hooksConfig = await loadHooks(paths.codexHooksPath);
  hooksConfig.hooks = mergeManagedHookEntries(
    hooksConfig.hooks,
    buildHookDefinitions(paths.targetPluginDir),
  );
  await mkdir(path.dirname(paths.codexHooksPath), { recursive: true });
  await writeFile(paths.codexHooksPath, JSON.stringify(hooksConfig, null, 2) + '\n', 'utf8');

  return {
    ...paths,
    marketplaceEntry: nextEntry,
  };
}

export function shouldAutoInstall(env = process.env) {
  if (env.RALPH_SKIP_PLUGIN_AUTO_INSTALL === '1') {
    return false;
  }

  if (env.RALPH_FORCE_PLUGIN_AUTO_INSTALL === '1') {
    return true;
  }

  return env.npm_config_global === 'true';
}

export function buildHookDefinitions(targetPluginDir, nodeBinary = process.execPath) {
  const hookCommand = `${quote(nodeBinary)} ${quote(path.join(targetPluginDir, 'scripts', 'ralph-hook.mjs'))}`;
  return {
    SessionStart: [
      {
        matcher: 'startup|resume',
        hooks: [
          {
            type: 'command',
            command: `${hookCommand} session-start`,
            statusMessage: 'Checking Ralph project state',
          },
        ],
      },
    ],
    UserPromptSubmit: [
      {
        hooks: [
          {
            type: 'command',
            command: `${hookCommand} user-prompt`,
            statusMessage: 'Evaluating Ralph workflow routing',
          },
        ],
      },
    ],
    PostToolUse: [
      {
        matcher: 'Write|Edit',
        hooks: [
          {
            type: 'command',
            command: `${hookCommand} post-write`,
            statusMessage: 'Refreshing Ralph task context',
          },
        ],
      },
    ],
  };
}

export function mergeManagedHookEntries(existingHooks = {}, managedHooks = {}) {
  const merged = { ...existingHooks };

  for (const [eventName, entries] of Object.entries(managedHooks)) {
    const current = Array.isArray(merged[eventName]) ? merged[eventName] : [];
    const filtered = current.filter((entry) => !isManagedRalphEntry(entry));
    merged[eventName] = [...filtered, ...entries];
  }

  return merged;
}

async function loadMarketplace(marketplacePath) {
  if (!existsSync(marketplacePath)) {
    return {
      name: 'openai-ralph-codex-marketplace',
      interface: {
        displayName: 'OpenAI Ralph Codex Plugins',
      },
      plugins: [],
    };
  }

  const parsed = JSON.parse(await readFile(marketplacePath, 'utf8'));
  return {
    name: parsed.name ?? 'openai-ralph-codex-marketplace',
    interface: {
      displayName:
        parsed.interface?.displayName ?? 'OpenAI Ralph Codex Plugins',
    },
    plugins: Array.isArray(parsed.plugins) ? parsed.plugins : [],
  };
}

async function loadHooks(hooksPath) {
  if (!existsSync(hooksPath)) {
    return { hooks: {} };
  }

  const parsed = JSON.parse(await readFile(hooksPath, 'utf8'));
  return {
    hooks:
      parsed && typeof parsed === 'object' && parsed.hooks && typeof parsed.hooks === 'object'
        ? parsed.hooks
        : {},
  };
}

function isManagedRalphEntry(entry) {
  return entry?.hooks?.some((hook) =>
    typeof hook?.command === 'string' && hook.command.includes('ralph-hook.mjs'),
  );
}

function quote(value) {
  return `"${value.replace(/"/g, '\\"')}"`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await installHomePlugin();
  process.stdout.write(
    [
      `Installed Ralph plugin to ${result.targetPluginDir}`,
      `Updated marketplace: ${result.marketplacePath}`,
      `Updated Codex hooks: ${result.codexHooksPath}`,
      'Codex should now see OpenAI Ralph Codex as an installed-by-default local plugin.',
    ].join('\n') + '\n',
  );
}
