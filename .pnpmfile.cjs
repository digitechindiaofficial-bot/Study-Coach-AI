module.exports = {
  hooks: {
    readPackage(pkg) {
      if (['@google/genai', 'esbuild', 'protobufjs'].includes(pkg.name)) {
        pkg.pnpm = pkg.pnpm || {};
        pkg.pnpm.allowBuild = true;
      }
      return pkg;
    }
  }
}
