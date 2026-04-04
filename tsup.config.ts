import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'index': 'src/index.ts',
    'hooks/user-prompt-submit': 'src/hooks/user-prompt-submit.ts',
    'hooks/pre-tool-use': 'src/hooks/pre-tool-use.ts',
    'hooks/post-tool-use': 'src/hooks/post-tool-use.ts',
    'hooks/post-tool-use-failure': 'src/hooks/post-tool-use-failure.ts',
    'hooks/permission-request': 'src/hooks/permission-request.ts',
    'hooks/stop': 'src/hooks/stop.ts',
    'delivery/run-evolve': 'src/delivery/run-evolve.ts',
    'cli': 'src/cli.ts',
  },
  format: ['esm'],
  target: 'node22',
  dts: {
    entry: {
      'index': 'src/index.ts',
      'hooks/user-prompt-submit': 'src/hooks/user-prompt-submit.ts',
      'hooks/pre-tool-use': 'src/hooks/pre-tool-use.ts',
      'hooks/post-tool-use': 'src/hooks/post-tool-use.ts',
      'hooks/post-tool-use-failure': 'src/hooks/post-tool-use-failure.ts',
      'hooks/permission-request': 'src/hooks/permission-request.ts',
      'hooks/stop': 'src/hooks/stop.ts',
      'delivery/run-evolve': 'src/delivery/run-evolve.ts',
    },
  },
  clean: true,
  sourcemap: true,
  splitting: false,
  shims: false,
});
