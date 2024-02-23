const test = require('brittle')
const path = require('bare-path')
const os = require('bare-os')
const fs = require('.')

const isWindows = os.platform() === 'win32'

test('open + close', async (t) => {
  t.plan(2)

  const file = await withFile(t, 'test/fixtures/foo.txt')

  fs.open(file, (err, fd) => {
    t.absent(err, 'opened')

    fs.close(fd, (err) => {
      t.absent(err, 'closed')
    })
  })
})

test('open + close sync', async (t) => {
  const file = await withFile(t, 'test/fixtures/foo.txt')

  const fd = fs.openSync(file)

  fs.closeSync(fd)

  t.pass()
})

test('access', async (t) => {
  t.plan(1)

  const file = await withFile(t, 'test/fixtures/foo.txt')

  fs.access(file, (err) => {
    t.absent(err, 'accessed')
  })
})

test('access, file missing', async (t) => {
  t.plan(1)

  fs.access('test/fixtures/foo.txt', (err) => {
    t.ok(err, 'file missing')
  })
})

test('access sync', async (t) => {
  const file = await withFile(t, 'test/fixtures/foo.txt')

  fs.accessSync(file)
})

test('access async, file missing', async (t) => {
  try {
    fs.accessSync('test/fixtures/foo.txt')

    t.fail('should fail')
  } catch {
    t.pass('file missing')
  }
})

test('read', async (t) => {
  t.plan(5)

  const file = await withFile(t, 'test/fixtures/foo.txt', 'foo\n')

  fs.open(file, (err, fd) => {
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

  const file = await withFile(t, 'test/fixtures/foo.txt', 'foo\n')

  fs.open(file, (err, fd) => {
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

  const file = await withFile(t, 'test/fixtures/foo.txt', 'foo\n')

  fs.open(file, (err, fd) => {
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

  const file = await withFile(t, 'test/fixtures/foo.txt', 'foo\n')

  fs.open(file, (err, fd) => {
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

  const file = await withFile(t, 'test/fixtures/foo.txt', 'foo\n')

  fs.open(file, (err, fd) => {
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

  const file = await withFile(t, 'test/fixtures/foo.txt', false)

  fs.open(file, 'w+', (err, fd) => {
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

  const file = await withFile(t, 'test/fixtures/foo.txt', false)

  fs.open(file, 'w+', (err, fd) => {
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

  const file = await withFile(t, 'test/fixtures/foo.txt', false)

  fs.open(file, 'w+', (err, fd) => {
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

  const file = await withFile(t, 'test/fixtures/foo.txt', false)

  fs.open(file, 'w+', (err, fd) => {
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

  const file = await withFile(t, 'test/fixtures/foo.txt', false)

  fs.open(file, 'w+', (err, fd) => {
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

  const file = await withFile(t, 'test/fixtures/foo.txt', 'foo\n')

  fs.stat(file, (err, st) => {
    t.absent(err, 'stat')
    for (const [key, value] of Object.entries(st)) t.comment(key, value)
    t.ok(st)
  })
})

test('stat sync', async (t) => {
  const file = await withFile(t, 'test/fixtures/foo.txt', 'foo\n')

  const st = fs.statSync(file)

  for (const [key, value] of Object.entries(st)) t.comment(key, value)
  t.ok(st)
})

test('fstat', async (t) => {
  t.plan(4)

  const file = await withFile(t, 'test/fixtures/foo.txt', 'foo\n')

  fs.open(file, (err, fd) => {
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
  const file = await withFile(t, 'test/fixtures/foo.txt', 'foo\n')

  const fd = fs.openSync(file)

  const st = fs.fstatSync(fd)

  for (const [key, value] of Object.entries(st)) t.comment(key, value)
  t.ok(st)

  fs.closeSync(fd)
})

test('lstat', async (t) => {
  t.plan(3)

  const target = await withFile(t, 'test/fixtures/foo.txt', 'foo\n')
  const link = await withSymlink(t, 'test/fixtures/foo-link.txt', target)

  fs.lstat(link, (err, st) => {
    t.absent(err, 'stat')
    t.ok(st.isSymbolicLink())
    for (const [key, value] of Object.entries(st)) t.comment(key, value)
    t.ok(st)
  })
})

test('lstat sync', async (t) => {
  const target = await withFile(t, 'test/fixtures/foo.txt', 'foo\n')
  const link = await withSymlink(t, 'test/fixtures/foo-link.txt', target)

  const st = fs.lstatSync(link)

  t.ok(st.isSymbolicLink())
  for (const [key, value] of Object.entries(st)) t.comment(key, value)
  t.ok(st)
})

test('opendir + close', async (t) => {
  t.plan(2)

  await withDir(t, 'test/fixtures/dir')

  fs.opendir('test/fixtures/dir', (err, dir) => {
    t.absent(err, 'opened')

    dir.close((err) => {
      t.absent(err, 'closed')
    })
  })
})

test('opendirSync + closeSync', async (t) => {
  await withDir(t, 'test/fixtures/dir')

  const dir = fs.opendirSync('test/fixtures/dir')

  dir.closeSync()
})

test('opendir + asyncIterator', async (t) => {
  t.plan(2)

  await withDir(t, 'test/fixtures/dir')
  await withFile(t, 'test/fixtures/dir/foo.txt', 'hello\n')

  fs.opendir('test/fixtures/dir', async (err, dir) => {
    t.absent(err, 'opened')

    for await (const entry of dir) {
      t.comment(entry)
    }

    t.pass('iterated')
  })
})

test('opendirSync + iterator', async (t) => {
  await withDir(t, 'test/fixtures/dir')
  await withFile(t, 'test/fixtures/dir/foo.txt', 'hello\n')

  const dir = fs.opendirSync('test/fixtures/dir')

  for (const entry of dir) {
    t.comment(entry)
  }

  t.pass('iterated')
})

test('readdir', async (t) => {
  t.plan(2)

  await withDir(t, 'test/fixtures/dir')
  await withFile(t, 'test/fixtures/dir/foo.txt', 'hello\n')

  fs.readdir('test/fixtures/dir', (err, files) => {
    t.absent(err, 'read')

    for (const entry of files) {
      t.comment(entry)
    }

    t.pass('iterated')
  })
})

test('readdir + withFileTypes: true', async (t) => {
  t.plan(2)

  await withDir(t, 'test/fixtures/dir')
  await withFile(t, 'test/fixtures/dir/foo.txt', 'hello\n')

  fs.readdir('test/fixtures/dir', { withFileTypes: true }, (err, files) => {
    t.absent(err, 'read')

    for (const entry of files) {
      t.comment(entry)
    }

    t.pass('iterated')
  })
})

test('readdirSync', async (t) => {
  await withDir(t, 'test/fixtures/dir')
  await withFile(t, 'test/fixtures/dir/foo.txt', 'hello\n')

  const files = fs.readdirSync('test/fixtures/dir')

  for (const entry of files) {
    t.comment(entry)
  }

  t.pass('iterated')
})

test('readdirSync + withFileTypes: true', async (t) => {
  await withDir(t, 'test/fixtures/dir')
  await withFile(t, 'test/fixtures/dir/foo.txt', 'hello\n')

  const files = fs.readdirSync('test/fixtures/dir', { withFileTypes: true })

  for (const entry of files) {
    t.comment(entry)
  }

  t.pass('iterated')
})

test('writeFile + readFile', async (t) => {
  t.plan(3)

  const file = await withFile(t, 'test/fixtures/foo.txt', false)

  fs.writeFile(file, Buffer.from('foo\n'), (err) => {
    t.absent(err)

    fs.readFile(file, (err, data) => {
      t.absent(err)
      t.alike(data, Buffer.from('foo\n'))
    })
  })
})

test('appendFile + readFile', async (t) => {
  t.plan(4)

  const file = await withFile(t, 'test/fixtures/foo.txt', false)

  fs.appendFile(file, Buffer.from('foo\n'), (err) => {
    t.absent(err)

    fs.appendFile(file, Buffer.from('bar\n'), (err) => {
      t.absent(err)

      fs.readFile(file, (err, data) => {
        t.absent(err)
        t.alike(data, Buffer.from('foo\nbar\n'))
      })
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

  await withDir(t, 'test/fixtures/foo', false)
  const dir = await withDir(t, 'test/fixtures/foo/bar/baz', false)

  fs.mkdir(dir, { recursive: true }, (err) => {
    t.absent(err, 'made dir')

    fs.stat(dir, (err, st) => {
      t.absent(err, 'stat')
      t.ok(st.isDirectory(), 'is dir')
    })
  })
})

test('realpath', async (t) => {
  t.plan(2)

  await withDir(t, 'test/fixtures/foo')
  const link = await withSymlink(t, 'test/fixtures/foo-link', 'foo')

  fs.realpath(link, (err, link) => {
    t.absent(err)
    t.is(link, path.resolve('test/fixtures/foo'))
  })
})

test('realpath sync', async (t) => {
  await withDir(t, 'test/fixtures/foo')
  const link = await withSymlink(t, 'test/fixtures/foo-link', 'foo')

  t.is(fs.realpathSync(link), path.resolve('test/fixtures/foo'))
})

test('readlink', async (t) => {
  t.plan(2)

  const target = await withDir(t, 'test/fixtures/foo')
  const link = await withSymlink(t, 'test/fixtures/foo-link', 'foo')

  fs.readlink(link, (err, link) => {
    t.absent(err)
    t.is(link, isWindows ? path.resolve(target) : 'foo')
  })
})

test('readlink sync', async (t) => {
  const target = await withDir(t, 'test/fixtures/foo')
  const link = await withSymlink(t, 'test/fixtures/foo-link', 'foo')

  t.is(fs.readlinkSync(link), isWindows ? path.resolve(target) : 'foo')
})

test('symlink', async (t) => {
  t.plan(3)

  const target = await withDir(t, 'test/fixtures/foo')
  const link = await withSymlink(t, 'test/fixtures/foo-link')

  fs.symlink('foo', link, (err) => {
    t.absent(err)

    fs.readlink(link, (err, link) => {
      t.absent(err)
      t.is(link, isWindows ? path.resolve(target) : 'foo')
    })
  })
})

test('symlink sync', async (t) => {
  const target = await withDir(t, 'test/fixtures/foo')
  const link = await withSymlink(t, 'test/fixtures/foo-link')

  fs.symlinkSync('foo', link)

  t.is(fs.readlinkSync(link), isWindows ? path.resolve(target) : 'foo')
})

async function withFile (t, path, data = Buffer.alloc(0)) {
  if (data) await fs.promises.writeFile(path, data)

  t.teardown(() =>
    fs.promises.rm(path, { force: true })
  )

  return path
}

async function withSymlink (t, path, target = false) {
  if (target) {
    try {
      await fs.promises.rm(path)
    } catch {}

    await fs.promises.symlink(target, path)
  }

  t.teardown(() =>
    fs.promises.rm(path, { force: true })
  )

  return path
}

async function withDir (t, path, create = true) {
  if (create) await fs.promises.mkdir(path, { recursive: true })

  t.teardown(() =>
    fs.promises.rm(path, { force: true, recursive: true })
  )

  return path
}
