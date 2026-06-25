// Learn more https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Block stale pnpm _tmp_ directories that cause ENOENT spam in the watcher.
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : config.resolver.blockList
      ? [config.resolver.blockList]
      : []),
  /_tmp_\d+/,
];

// 1. Watch all files within the monorepo.
config.watchFolders = [workspaceRoot];

// 2. Resolve packages from the app first, then the workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Force Metro to resolve (sub)dependencies only from nodeModulesPaths.
//    Paired with .npmrc `public-hoist-pattern[]=*` so the flat tree resolves.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
