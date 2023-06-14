const test = require('brittle')
const fs = require('.')

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
    for (const [key, value] of Object.entries(st)) t.comment(key, value)
    t.ok(st)
  })
})

test('stat sync', (t) => {
  const st = fs.statSync('test/fixtures/foo.txt')

  for (const [key, value] of Object.entries(st)) t.comment(key, value)
  t.ok(st)
})

test('fstat', (t) => {
  t.plan(4)

  fs.open('test/fixtures/foo.txt', (err, fd) => {
    t.absent(err, 'opened')

    fs.fstat(fd, (err, st) => {
      t.absent(err, 'stat')
      for (const [key, value] of Object.entries(st)) t.comment(key, value)
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

  for (const [key, value] of Object.entries(st)) t.comment(key, value)
  t.ok(st)

  fs.closeSync(fd)
})

test('opendir + close', (t) => {
  t.plan(2)

  fs.opendir('test/fixtures', (err, dir) => {
    t.absent(err, 'opened')

    dir.close((err) => {
      t.absent(err, 'closed')
    })
  })
})

test('opendir + iterate entries', (t) => {
  t.plan(2)

  fs.opendir('test/fixtures', async (err, dir) => {
    t.absent(err, 'opened')

    for await (const entry of dir) {
      t.comment(entry)
    }

    t.pass('iterated')
  })
})

test('readdir', (t) => {
  t.plan(2)

  fs.readdir('test', (err, dir) => {
    t.absent(err, 'read')

    for (const entry of dir) {
      t.comment(entry)
    }

    t.pass('iterated')
  })
})

test('readdir + withFileTypes: true', (t) => {
  t.plan(2)

  fs.readdir('test', { withFileTypes: true }, (err, dir) => {
    t.absent(err, 'read')

    for (const entry of dir) {
      t.comment(entry)
    }

    t.pass('iterated')
  })
})

test('writeFile + readFile', (t) => {
  t.plan(3)

  fs.writeFile('test/fixtures/foo.txt', Buffer.from('foo\n'), (err) => {
    t.absent(err)

    fs.readFile('test/fixtures/foo.txt', (err, data) => {
      t.absent(err)
      t.alike(data, Buffer.from('foo\n'))
    })
  })
})

test('mkdir', (t) => {
  t.plan(3)

  fs.mkdir('test/fixtures/foo', (err) => {
    if (err) t.pass('dir exists')
    else t.pass('made dir')

    fs.stat('test/fixtures/foo', (err, st) => {
      t.absent(err, 'stat')
      t.ok(st.isDirectory(), 'is dir')
    })
  })
})

test('mkdir recursive', (t) => {
  t.plan(3)

  fs.mkdir('test/fixtures/foo/bar/baz', { recursive: true }, (err) => {
    t.absent(err, 'made dir')

    fs.stat('test/fixtures/foo/bar/baz', (err, st) => {
      t.absent(err, 'stat')
      t.ok(st.isDirectory(), 'is dir')
    })
  })
})

test('readlink', (t) => {
  t.plan(1)

  fs.readlink('test/fixtures/foo-link.txt', (err, link) => {
    t.comment(link)
    t.absent(err)
  })
})
