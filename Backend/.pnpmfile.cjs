// @prisma/client declares the Prisma CLI and TypeScript as optional peers.
// pnpm links them because both are root devDependencies, which drags the CLI
// into production installs. The client does not need either one at runtime.
function readPackage(pkg) {
  if (pkg.name === '@prisma/client') {
    for (const peer of ['prisma', 'typescript']) {
      delete pkg.peerDependencies?.[peer];
      delete pkg.peerDependenciesMeta?.[peer];
    }
  }
  return pkg;
}

module.exports = { hooks: { readPackage } };
