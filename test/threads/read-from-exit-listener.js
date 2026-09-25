const fs = require('../..')

Bare.on('exit', () => {
  fs.readFile(__filename, () => {})
})
