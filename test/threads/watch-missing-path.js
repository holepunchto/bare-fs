const fs = require('../..')

try {
  fs.watch('test/fixtures/does-not-exist')
} catch {}
