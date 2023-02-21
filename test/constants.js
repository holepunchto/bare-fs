const test = require('brittle')
const fsnode = require('fs')
const fs = require('../index.js')

test('constants', function (t) {
  const linuxOnly = ['S_IFBLK', 'S_IFIFO', 'S_IFSOCK']

  for (const key in fs.constants) {
    if (process.platform === 'win32' && linuxOnly.indexOf(key) > -1) {
      t.is(fs.constants[key], 0, key + ' is exported (linux only)')
      continue
    }

    t.is(fs.constants[key], fsnode.constants[key], key + ' is exported')
  }

  for (const key in fsnode.constants) {
    if (!fs.constants[key]) {
      t.comment('missing constant: ' + key)
    }
  }
})
