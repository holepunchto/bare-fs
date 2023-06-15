const test = require('brittle')
const fs = require('.')

test('open + close', (t) => {
  t.teardown(onteardown)
  t.plan(2)

  fs.open('test/fixtures/foo.txt', (err, fd) => {
    t.absent(err, 'opened')

    fs.close(fd, (err) => {
      t.absent(err, 'closed')
    })
  })
})

test('open + close sync', (t) => {
  t.teardown(onteardown)

  const fd = fs.openSync('test/fixtures/foo.txt')

  fs.closeSync(fd)

  t.pass()
})

test('read', (t) => {
  t.teardown(onteardown)
  t.plan(5)

  fs.open('test/fixtures/foo.txt', (err, fd) => {
    t.absent(err, 'opened')

    const data = Buffer.alloc(4)

    fs.read(fd, data, 0, 4, 0, (err, len) => {
      t.absent(err)
      t.is(len, 4)
      t.alike(data, Buffer.from('foo\n'))

      fs.close(fd, (err) => {
        t.absent(err, 'closed')
      })
    })
  })
})

test('read + offset', (t) => {
  t.teardown(onteardown)
  t.plan(5)

  fs.open('test/fixtures/foo.txt', (err, fd) => {
    t.absent(err, 'opened')

    const data = Buffer.alloc(4)

    fs.read(fd, data, 2, 2, 0, (err, len) => {
      t.absent(err)
      t.is(len, 2)
      t.alike(data, Buffer.from('\x00\x00fo'))

      fs.close(fd, (err) => {
        t.absent(err, 'closed')
      })
    })
  })
})

test('read + position', (t) => {
  t.teardown(onteardown)
  t.plan(5)

  fs.open('test/fixtures/foo.txt', (err, fd) => {
    t.absent(err, 'opened')

    const data = Buffer.alloc(2)

    fs.read(fd, data, 0, 2, 2, (err, len) => {
      t.absent(err)
      t.is(len, 2)
      t.alike(data, Buffer.from('o\n'))

      fs.close(fd, (err) => {
        t.absent(err, 'closed')
      })
    })
  })
})

test('read + current position', (t) => {
  t.teardown(onteardown)
  t.plan(8)

  fs.open('test/fixtures/foo.txt', (err, fd) => {
    t.absent(err, 'opened')

    const data = Buffer.alloc(2)

    fs.read(fd, data, 0, 2, -1, (err, len) => {
      t.absent(err)
      t.is(len, 2)
      t.alike(data, Buffer.from('fo'))

      fs.read(fd, data, 0, 2, -1, (err, len) => {
        t.absent(err)
        t.is(len, 2)
        t.alike(data, Buffer.from('o\n'))

        fs.close(fd, (err) => {
          t.absent(err, 'closed')
        })
      })
    })
  })
})

test('write', (t) => {
  t.teardown(onteardown)
  t.plan(7)

  fs.open('test/fixtures/foo.txt', 'w+', (err, fd) => {
    t.absent(err, 'opened')

    const data = Buffer.from('foo\n')

    fs.write(fd, data, 0, 4, 0, (err, len) => {
      t.absent(err)
      t.is(len, 4)

      const data = Buffer.alloc(4)

      fs.read(fd, data, 0, 4, 0, (err, len) => {
        t.absent(err)
        t.is(len, 4)
        t.alike(data, Buffer.from('foo\n'))

        fs.close(fd, (err) => {
          t.absent(err, 'closed')
        })
      })
    })
  })
})

test('write + offset', (t) => {
  t.teardown(onteardown)
  t.plan(7)

  fs.open('test/fixtures/foo.txt', 'w+', (err, fd) => {
    t.absent(err, 'opened')

    const data = Buffer.from('foo\n')

    fs.write(fd, data, 2, 4, 2, (err, len) => {
      t.absent(err)
      t.is(len, 4)

      const data = Buffer.alloc(4)

      fs.read(fd, data, 0, 4, 0, (err, len) => {
        t.absent(err)
        t.is(len, 4)
        t.alike(data, Buffer.from('\x00\x00o\n'))

        fs.close(fd, (err) => {
          t.absent(err, 'closed')
        })
      })
    })
  })
})

test('write + position', (t) => {
  t.teardown(onteardown)
  t.plan(7)

  fs.open('test/fixtures/foo.txt', 'w+', (err, fd) => {
    t.absent(err, 'opened')

    const data = Buffer.from('o\n')

    fs.write(fd, data, 0, 2, 2, (err, len) => {
      t.absent(err)
      t.is(len, 2)

      const data = Buffer.alloc(4)

      fs.read(fd, data, 0, 4, 0, (err, len) => {
        t.absent(err)
        t.is(len, 4)
        t.alike(data, Buffer.from('\x00\x00o\n'))

        fs.close(fd, (err) => {
          t.absent(err, 'closed')
        })
      })
    })
  })
})

test('write + current position', (t) => {
  t.teardown(onteardown)
  t.plan(9)

  fs.open('test/fixtures/foo.txt', 'w+', (err, fd) => {
    t.absent(err, 'opened')

    const data = Buffer.from('foo\n')

    fs.write(fd, data, 0, 2, -1, (err, len) => {
      t.absent(err)
      t.is(len, 2)

      fs.write(fd, data, 2, 2, -1, (err, len) => {
        t.absent(err)
        t.is(len, 2)

        const data = Buffer.alloc(4)

        fs.read(fd, data, 0, 4, 0, (err, len) => {
          t.absent(err)
          t.is(len, 4)
          t.alike(data, Buffer.from('foo\n'))

          fs.close(fd, (err) => {
            t.absent(err, 'closed')
          })
        })
      })
    })
  })
})

test('stat', (t) => {
  t.teardown(onteardown)
  t.plan(2)

  fs.stat('test/fixtures/foo.txt', (err, st) => {
    t.absent(err, 'stat')
    for (const [key, value] of Object.entries(st)) t.comment(key, value)
    t.ok(st)
  })
})

test('stat sync', (t) => {
  t.teardown(onteardown)

  const st = fs.statSync('test/fixtures/foo.txt')

  for (const [key, value] of Object.entries(st)) t.comment(key, value)
  t.ok(st)
})

test('fstat', (t) => {
  t.teardown(onteardown)
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
  t.teardown(onteardown)

  const fd = fs.openSync('test/fixtures/foo.txt')

  const st = fs.fstatSync(fd)

  for (const [key, value] of Object.entries(st)) t.comment(key, value)
  t.ok(st)

  fs.closeSync(fd)
})

test('lstat', (t) => {
  t.teardown(onteardown)
  t.plan(3)

  fs.lstat('test/fixtures/foo-link.txt', (err, st) => {
    t.absent(err, 'stat')
    t.ok(st.isSymbolicLink())
    for (const [key, value] of Object.entries(st)) t.comment(key, value)
    t.ok(st)
  })
})

test('lstat sync', (t) => {
  t.teardown(onteardown)

  const st = fs.lstatSync('test/fixtures/foo-link.txt')

  t.ok(st.isSymbolicLink())
  for (const [key, value] of Object.entries(st)) t.comment(key, value)
  t.ok(st)
})

test('opendir + close', (t) => {
  t.teardown(onteardown)
  t.plan(2)

  fs.opendir('test/fixtures', (err, dir) => {
    t.absent(err, 'opened')

    dir.close((err) => {
      t.absent(err, 'closed')
    })
  })
})

test('opendir + iterate entries', (t) => {
  t.teardown(onteardown)
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
  t.teardown(onteardown)
  t.plan(2)

  fs.readdir('test/fixtures', (err, dir) => {
    t.absent(err, 'read')

    for (const entry of dir) {
      t.comment(entry)
    }

    t.pass('iterated')
  })
})

test('readdir + withFileTypes: true', (t) => {
  t.teardown(onteardown)
  t.plan(2)

  fs.readdir('test/fixtures', { withFileTypes: true }, (err, dir) => {
    t.absent(err, 'read')

    for (const entry of dir) {
      t.comment(entry)
    }

    t.pass('iterated')
  })
})

test('writeFile + readFile', (t) => {
  t.teardown(onteardown)
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
  t.teardown(onteardown)
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
  t.teardown(onteardown)
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
  t.teardown(onteardown)
  t.plan(2)

  fs.readlink('test/fixtures/foo-link.txt', (err, link) => {
    t.is(link, 'foo.txt')
    t.absent(err)
  })
})

async function onteardown () {
  fs.writeFileSync('test/fixtures/foo.txt', Buffer.from('foo\n'))
}
