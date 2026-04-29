import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  // Workspace packages export raw .ts (`"exports": "./src/index.ts"`),
  // so they must be bundled into the API output. Otherwise the runtime
  // image fails with `ERR_UNKNOWN_FILE_EXTENSION ".ts"` when Node tries
  // to load `@nuit-one/db` / `@nuit-one/shared` from node_modules.
  noExternal: ['@nuit-one/shared', '@nuit-one/db'],
});
