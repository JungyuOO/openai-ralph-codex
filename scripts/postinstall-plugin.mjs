import { installHomePlugin, shouldAutoInstall } from './install-home-plugin.mjs';

if (!shouldAutoInstall(process.env)) {
  process.exit(0);
}

try {
  const result = await installHomePlugin();
  process.stdout.write(
    [
      '[openai-ralph-codex] Installed local Codex plugin automatically.',
      `Plugin path: ${result.targetPluginDir}`,
      `Marketplace: ${result.marketplacePath}`,
    ].join('\n') + '\n',
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(
    `[openai-ralph-codex] Automatic plugin install failed: ${message}`,
  );
  console.warn(
    '[openai-ralph-codex] You can retry manually with `ralph plugin install` after building the package.',
  );
}
