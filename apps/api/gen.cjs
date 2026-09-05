/* Offline Prisma Client generator driver.
   Runs @prisma/client's generator as an RPC subprocess with an ABSOLUTE path
   (the generator only starts its RPC loop when process.argv[1] === __filename)
   and writes the generated client into @prisma/client/.prisma/client, which is
   exactly where the shipped @prisma/client (v6) re-exports from. */
const fs = require('node:fs');
const path = require('node:path');
const { getDMMF } = require('@prisma/internals');
const { GeneratorProcess } = require('@prisma/generator-helper');

const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma');
const datamodel = fs.readFileSync(schemaPath, 'utf8');
const clientDir = path.dirname(require.resolve('@prisma/client/package.json'));
// `@prisma/client` resolves its generated client via `require('.prisma/client/default')`,
// which Node treats as a package lookup (not a relative path). The only node_modules
// directory reachable from the store package is the virtual-store's own node_modules,
// so the generated client must live there:
//   node_modules/.pnpm/@prisma+client@.../node_modules/.prisma/client
const outputDir = path.join(path.dirname(path.dirname(clientDir)), '.prisma', 'client');
const generatorPath = path.join(clientDir, 'generator-build', 'index.js');

async function main() {
  const dmmf = await getDMMF({ datamodel });
  console.log('DMMF ok, models:', Object.keys(dmmf.datamodel.models).length);
  fs.mkdirSync(outputDir, { recursive: true });

  const gp = new GeneratorProcess(generatorPath, { isNode: true });
  await gp.init();

  const params = {
    datamodel,
    binaryPaths: {},
    generator: {
      name: 'client',
      provider: { fromEnvVar: null, value: 'prisma-client-js' },
      output: { value: outputDir, fromEnvVar: null },
      config: { engineType: 'client' },
      binaryTargets: [],
      previewFeatures: [],
      sourceFilePath: schemaPath,
    },
    otherGenerators: [],
    schemaPath,
    dmmf,
    envPaths: { rootEnvPath: null, schemaEnvPath: null },
    datasources: [
      {
        name: 'db',
        provider: 'postgresql',
        activeProvider: 'postgresql',
        url: { fromEnvVar: null, value: process.env.DATABASE_URL || 'postgresql://srip:srip@127.0.0.1:5432/srip' },
        sourceFilePath: schemaPath,
      },
    ],
    version: '6.19.3',
    noEngine: false,
    postinstall: false,
  };

  await gp.generate(params);
  console.log('GENERATED OK ->', outputDir);
  gp.stop();
}

main().catch((e) => { console.error('GEN ERR:', e); process.exit(1); });
