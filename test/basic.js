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

test('open + close sync', (t) => {
  const fd = fs.openSync('test/fixtures/foo.txt')

  fs.closeSync(fd)

  t.pass()
})

test('stat', (t) => {
  t.plan(2)

  fs.stat('test/fixtures/foo.txt', (err, st) => {
    t.absent(err, 'stat')
    t.ok(st)
  })
})

test('stat sync', (t) => {
  const st = fs.statSync('test/fixtures/foo.txt')

  t.ok(st)
})

test('fstat', (t) => {
  t.plan(4)

  fs.open('test/fixtures/foo.txt', (err, fd) => {
    t.absent(err, 'opened')

    fs.fstat(fd, (err, st) => {
      t.absent(err, 'stat')
      t.ok(st)

      fs.close(fd, (err) => {
        t.absent(err, 'closed')
      })
    })
  })
})

test('fstat sync', (t) => {
  const fd = fs.openSync('test/fixtures/foo.txt')

  const st = fs.fstatSync(fd)

  t.ok(st)

  fs.closeSync(fd)
})
