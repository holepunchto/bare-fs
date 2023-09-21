const test = require('brittle')
const fs = require('.')

test('open + close', async (t) => {
  t.plan(2)

  const path = await withFile(t, 'test/fixtures/foo.txt')

  fs.open(path, (err, fd) => {
    t.absent(err, 'opened')

    fs.close(fd, (err) => {
      t.absent(err, 'closed')
    })
  })
})

test('open + close sync', async (t) => {
  const path = await withFile(t, 'test/fixtures/foo.txt')

  const fd = fs.openSync(path)

  fs.closeSync(fd)

  t.pass()
})

test('read', async (t) => {
  t.plan(5)

  const path = await withFile(t, 'test/fixtures/foo.txt', 'foo\n')

  fs.open(path, (err, fd) => {
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

test('read + offset', async (t) => {
  t.plan(5)

  const path = await withFile(t, 'test/fixtures/foo.txt', 'foo\n')

  fs.open(path, (err, fd) => {
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

test('read + position', async (t) => {
  t.plan(5)

  const path = await withFile(t, 'test/fixtures/foo.txt', 'foo\n')

  fs.open(path, (err, fd) => {
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

test('read + current position', async (t) => {
  t.plan(8)

  const path = await withFile(t, 'test/fixtures/foo.txt', 'foo\n')

  fs.open(path, (err, fd) => {
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

test('read out of buffer bounds', async (t) => {
  t.plan(6)

  const path = await withFile(t, 'test/fixtures/foo.txt', 'foo\n')

  fs.open(path, (err, fd) => {
    t.absent(err, 'opened')

    const data = Buffer.alloc(4)

    fs.read(fd, data, 0, 4, 0, (err, len) => {
      t.absent(err)
      t.is(len, 4)

      fs.read(fd, data, 6, 4, 0, (err, len) => {
        t.absent(err)
        t.is(len, 0)

        fs.close(fd, (err) => {
          t.absent(err, 'closed')
        })
      })
    })
  })
})

test('write', async (t) => {
  t.plan(7)

  const path = await withFile(t, 'test/fixtures/foo.txt', false)

  fs.open(path, 'w+', (err, fd) => {
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

test('write + offset', async (t) => {
  t.plan(7)

  const path = await withFile(t, 'test/fixtures/foo.txt', false)

  fs.open(path, 'w+', (err, fd) => {
    t.absent(err, 'opened')

    const data = Buffer.from('foo\n')

    fs.write(fd, data, 2, 2, 2, (err, len) => {
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

test('write + position', async (t) => {
  t.plan(7)

  const path = await withFile(t, 'test/fixtures/foo.txt', false)

  fs.open(path, 'w+', (err, fd) => {
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

test('write + current position', async (t) => {
  t.plan(9)

  const path = await withFile(t, 'test/fixtures/foo.txt', false)

  fs.open(path, 'w+', (err, fd) => {
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

test('write out of buffer bounds', async (t) => {
  t.plan(6)

  const path = await withFile(t, 'test/fixtures/foo.txt', false)

  fs.open(path, 'w+', (err, fd) => {
    t.absent(err, 'opened')

    const data = Buffer.from('foo\n')

    fs.write(fd, data, 0, 6, 0, (err, len) => {
      t.absent(err)
      t.is(len, 4)

      fs.write(fd, data, 6, 4, 0, (err, len) => {
        t.absent(err)
        t.is(len, 0)

        fs.close(fd, (err) => {
          t.absent(err, 'closed')
        })
      })
    })
  })
})

test('stat', async (t) => {
  t.plan(2)

  const path = await withFile(t, 'test/fixtures/foo.txt', 'foo\n')

  fs.stat(path, (err, st) => {
    t.absent(err, 'stat')
    for (const [key, value] of Object.entries(st)) t.comment(key, value)
    t.ok(st)
  })
})

test('stat sync', async (t) => {
  const path = await withFile(t, 'test/fixtures/foo.txt', 'foo\n')

  const st = fs.statSync(path)

  for (const [key, value] of Object.entries(st)) t.comment(key, value)
  t.ok(st)
})

test('fstat', async (t) => {
  t.plan(4)

  const path = await withFile(t, 'test/fixtures/foo.txt', 'foo\n')

  fs.open(path, (err, fd) => {
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

test('fstat sync', async (t) => {
  const path = await withFile(t, 'test/fixtures/foo.txt', 'foo\n')

  const fd = fs.openSync(path)

  const st = fs.fstatSync(fd)

  for (const [key, value] of Object.entries(st)) t.comment(key, value)
  t.ok(st)

  fs.closeSync(fd)
})

test('lstat', async (t) => {
  t.plan(3)

  const target = await withFile(t, 'test/fixtures/foo.txt', 'foo\n')
  const path = await withSymlink(t, 'test/fixtures/foo-link.txt', target)

  fs.lstat(path, (err, st) => {
    t.absent(err, 'stat')
    t.ok(st.isSymbolicLink())
    for (const [key, value] of Object.entries(st)) t.comment(key, value)
    t.ok(st)
  })
})

test('lstat sync', async (t) => {
  const target = await withFile(t, 'test/fixtures/foo.txt', 'foo\n')
  const path = await withSymlink(t, 'test/fixtures/foo-link.txt', target)

  const st = fs.lstatSync(path)

  t.ok(st.isSymbolicLink())
  for (const [key, value] of Object.entries(st)) t.comment(key, value)
  t.ok(st)
})

test('opendir + close', async (t) => {
  t.plan(2)

  const dir = await withDir(t, 'test/fixtures/dir')

  fs.opendir(dir, (err, dir) => {
    t.absent(err, 'opened')

    dir.close((err) => {
      t.absent(err, 'closed')
    })
  })
})

test('opendir + iterate entries', async (t) => {
  t.plan(2)

  const dir = await withDir(t, 'test/fixtures/dir')

  fs.opendir(dir, async (err, dir) => {
    t.absent(err, 'opened')

    for await (const entry of dir) {
      t.comment(entry)
    }

    t.pass('iterated')
  })
})

test('readdir', async (t) => {
  t.plan(2)

  const dir = await withDir(t, 'test/fixtures/dir')

  fs.readdir(dir, (err, dir) => {
    t.absent(err, 'read')

    for (const entry of dir) {
      t.comment(entry)
    }

    t.pass('iterated')
  })
})

test('readdir + withFileTypes: true', async (t) => {
  t.plan(2)

  const dir = await withDir(t, 'test/fixtures/dir')

  fs.readdir(dir, { withFileTypes: true }, (err, dir) => {
    t.absent(err, 'read')

    for (const entry of dir) {
      t.comment(entry)
    }

    t.pass('iterated')
  })
})

test('writeFile + readFile', async (t) => {
  t.plan(3)

  const path = await withFile(t, 'test/fixtures/foo.txt', false)

  fs.writeFile(path, Buffer.from('foo\n'), (err) => {
    t.absent(err)

    fs.readFile(path, (err, data) => {
      t.absent(err)
      t.alike(data, Buffer.from('foo\n'))
    })
  })
})

test('mkdir', async (t) => {
  t.plan(3)

  const dir = await withDir(t, 'test/fixtures/foo', false)

  fs.mkdir(dir, (err) => {
    if (err) t.pass('dir exists')
    else t.pass('made dir')

    fs.stat(dir, (err, st) => {
      t.absent(err, 'stat')
      t.ok(st.isDirectory(), 'is dir')
    })
  })
})

test('mkdir recursive', async (t) => {
  t.plan(3)

  const dir = await withDir(t, 'test/fixtures/foo/bar/baz', false)
  await withDir(t, 'test/fixtures/foo/bar', false)
  await withDir(t, 'test/fixtures/foo', false)

  fs.mkdir(dir, { recursive: true }, (err) => {
    t.absent(err, 'made dir')

    fs.stat(dir, (err, st) => {
      t.absent(err, 'stat')
      t.ok(st.isDirectory(), 'is dir')
    })
  })
})

test('readlink', async (t) => {
  t.plan(2)

  await withFile(t, 'test/fixtures/foo.txt', 'foo\n')
  const path = await withSymlink(t, 'test/fixtures/foo-link.txt', 'foo.txt')

  fs.readlink(path, (err, link) => {
    t.absent(err)
    t.is(link, 'foo.txt')
  })
})

test('readlink sync', async (t) => {
  await withFile(t, 'test/fixtures/foo.txt', 'foo\n')
  const path = await withSymlink(t, 'test/fixtures/foo-link.txt', 'foo.txt')

  t.is(fs.readlinkSync(path), 'foo.txt')
})

test('symlink', async (t) => {
  t.plan(3)

  await withFile(t, 'test/fixtures/foo.txt', 'foo\n')
  const path = await withSymlink(t, 'test/fixtures/foo-link.txt')

  fs.symlink('foo.txt', path, (err) => {
    t.absent(err)

    fs.readlink(path, (err, link) => {
      t.absent(err)
      t.is(link, 'foo.txt')
    })
  })
})

test('symlink sync', async (t) => {
  await withFile(t, 'test/fixtures/foo.txt', 'foo\n')
  const path = await withSymlink(t, 'test/fixtures/foo-link.txt')

  fs.symlinkSync('foo.txt', path)

  t.is(fs.readlinkSync(path), 'foo.txt')
})

async function withFile (t, path, data = Buffer.alloc(0)) {
  if (data) await fs.promises.writeFile(path, data)

  t.teardown(() =>
    fs.promises.unlink(path).catch()
  )

  return path
}

async function withSymlink (t, path, target = false) {
  if (target) await fs.promises.symlink(target, path)

  t.teardown(() =>
    fs.promises.unlink(path).catch()
  )

  return path
}

async function withDir (t, path, create = true) {
  if (create) await fs.promises.mkdir(path, { recursive: true })

  t.teardown(() =>
    fs.promises.rmdir(path).catch()
  )

  return path
}
