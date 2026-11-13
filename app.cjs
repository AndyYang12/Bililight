// Plesk / HelioHost start Node apps with CommonJS require(), which cannot load
// an ES module on Node < 22. This wrapper sets the port and bridges to the ESM
// entry, so the same code runs under Passenger and under plain `node`.
process.env.PORT = process.env.PORT || '3000';

import('./run.mjs').catch((e) => {
  console.error(e);
  process.exit(1);
});
