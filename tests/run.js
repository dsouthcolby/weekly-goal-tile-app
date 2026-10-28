// Runs every browser test and exits non-zero if any step fails. See tests/README.md.
(async () => {
  let failed = 0;
  for (const f of ['./local.test.js', './cloud.test.js']) failed += await require(f)();
  console.log(failed ? `\n${failed} step${failed === 1 ? '' : 's'} failed` : '\nAll tests passed');
  process.exit(failed ? 1 : 0);
})();
