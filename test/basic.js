const test = require('brittle')
const fs = require('..')

test('open + close', (t) => {
  t.plan(2)

  fs.open('test/fixtures/foo.txt', (err, fd) => {
    t.absent(err, 'opened')

    fs.close(fd, (err) => {
      t.absent(err, 'closed')
    })
  })
})

test('stat', (t) => {
  t.plan(1)

  fs.stat('test/fixtures/foo.txt', (err, st) => {
    t.absent(err, 'stat')
  })
})
