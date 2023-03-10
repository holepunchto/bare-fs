const test = require('brittle')
const fs = require('..')

test('readlink', (t) => {
  t.plan(1)

  fs.readlink('test/fixtures/foo-link.txt', (err, link) => {
    t.comment(link)
    t.absent(err)
  })
})
