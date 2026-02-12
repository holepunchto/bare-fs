const test = require('brittle')
const path = require('bare-path')
const crypto = require('bare-crypto')
const fs = require('.')

const isWindows = Bare.platform === 'win32'

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

test('open + close, long path', async (t) => {
  t.plan(2)

  const dir = await withDir(
    t,
    `test/fixtures/${'a'.repeat(128)}/${'b'.repeat(128)}/${'c'.repeat(128)}`
  )

  const file = await withFile(t, `${dir}/${'d'.repeat(128)}.txt`)

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

test('access, is executable', { skip: isWindows }, async (t) => {
  t.plan(1)

  const file = await withFile(t, 'test/fixtures/foo.txt', Buffer.alloc(0), {
    mode: 0o755
  })

  fs.access(file, fs.constants.X_OK, (err) => {
    t.absent(err)
  })
})

test('access, is not executable', { skip: isWindows }, async (t) => {
  t.plan(1)

  const file = await withFile(t, 'test/fixtures/foo.txt')

  fs.access(file, fs.constants.X_OK, (err) => {
    t.ok(err)
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

test('read sync', async (t) => {
  const file = await withFile(t, 'test/fixtures/foo.txt', 'foo\n')

  const fd = fs.openSync(file)

  const data = Buffer.alloc(4)
  const len = fs.readSync(fd, data, 0, 4, 0)
  t.is(len, 4)
  t.alike(data, Buffer.from('foo\n'))

  fs.closeSync(fd)
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

test('write in append mode', async (t) => {
  t.plan(9)

  const file = await withFile(t, 'test/fixtures/foo.txt', false)

  fs.open(file, 'a+', (err, fd) => {
    t.absent(err, 'opened')

    fs.write(fd, Buffer.from('foo'), (err, len) => {
      t.absent(err)
      t.is(len, 3)

      fs.write(fd, Buffer.from('bar\n'), (err, len) => {
        t.absent(err)
        t.is(len, 4)

        const data = Buffer.alloc(7)

        fs.read(fd, data, 0, 7, 0, (err, len) => {
          t.absent(err)
          t.is(len, 7)
          t.alike(data, Buffer.from('foobar\n'))

          fs.close(fd, (err) => {
            t.absent(err, 'closed')
          })
        })
      })
    })
  })
})

test('write string in append mode', async (t) => {
  t.plan(9)

  const file = await withFile(t, 'test/fixtures/foo.txt', false)

  fs.open(file, 'a+', (err, fd) => {
    t.absent(err, 'opened')

    fs.write(fd, 'foo', (err, len) => {
      t.absent(err)
      t.is(len, 3)

      fs.write(fd, 'bar\n', (err, len) => {
        t.absent(err)
        t.is(len, 4)

        const data = Buffer.alloc(7)

        fs.read(fd, data, 0, 7, 0, (err, len) => {
          t.absent(err)
          t.is(len, 7)
          t.alike(data, Buffer.from('foobar\n'))

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

test('write string', async (t) => {
  t.plan(4)

  const file = await withFile(t, 'test/fixtures/foo.txt', false)

  fs.open(file, 'w+', (err, fd) => {
    t.absent(err, 'opened')

    const data = 'foo\n'

    fs.write(fd, data, (err, len) => {
      t.absent(err)
      t.is(len, 4)

      fs.close(fd, (err) => {
        t.absent(err, 'closed')
      })
    })
  })
})

test('write sync', async (t) => {
  const file = await withFile(t, 'test/fixtures/foo.txt', false)

  const fd = fs.openSync(file, 'w+')

  let data
  let len

  data = Buffer.from('foo\n')
  len = fs.writeSync(fd, data, 0, 4, 0)
  t.is(len, 4)

  data = Buffer.alloc(4)
  len = fs.readSync(fd, data, 0, 4, 0)
  t.is(len, 4)
  t.alike(data, Buffer.from('foo\n'))

  fs.closeSync(fd)
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

test('utimes', async (t) => {
  t.plan(3)

  const file = await withFile(t, 'test/fixtures/foo.txt')

  const oldStat = fs.statSync(file)

  const future = new Date(Date.now() + 1000)
  fs.utimes(file, future, future, (err) => {
    t.absent(err)

    const newStat = fs.statSync(file)

    t.ok(oldStat.atimeMs < newStat.atimeMs)
    t.ok(oldStat.mtimeMs < newStat.mtimeMs)
  })
})

test('utimes sync', async (t) => {
  const file = await withFile(t, 'test/fixtures/foo.txt')

  const oldStat = fs.statSync(file)

  const future = Date.now() / 1000 + 1000
  fs.utimesSync(file, future, future)

  const newStat = fs.statSync(file)

  t.ok(oldStat.atimeMs < newStat.atimeMs)
  t.ok(oldStat.mtimeMs < newStat.mtimeMs)
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

test('readFile, file missing', async (t) => {
  t.plan(1)

  fs.readFile('test/fixtures/foo.txt', (err) => {
    t.ok(err, 'file missing')
  })
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

test('copyFile', async (t) => {
  t.plan(11)

  await withFile(t, 'test/fixtures/foo.txt', 'foo\n')

  fs.copyFile('test/fixtures/foo.txt', 'test/fixtures/bar.txt', (err) => {
    t.absent(err, 'file copied')

    fs.open('test/fixtures/foo.txt', (err, fd) => {
      t.absent(err, 'original copy opened')

      const data = Buffer.alloc(4)

      fs.read(fd, data, 0, 4, 0, (err, len) => {
        t.absent(err, 'read original copy')
        t.is(len, 4)
        t.alike(data, Buffer.from('foo\n'), 'check original copy content')

        fs.close(fd, (err) => {
          t.absent(err, 'original copy closed')
        })
      })
    })

    fs.open('test/fixtures/bar.txt', (err, fd) => {
      t.absent(err, 'new copy opened')

      const data = Buffer.alloc(4)

      fs.read(fd, data, 0, 4, 0, (err, len) => {
        t.absent(err, 'read new copy')
        t.is(len, 4)
        t.alike(data, Buffer.from('foo\n'), 'check new copy content')

        fs.close(fd, (err) => {
          t.absent(err, 'new copy closed')
        })
      })
    })
  })
})

test('copyFileSync', async (t) => {
  t.plan(10)

  await withFile(t, 'test/fixtures/foo.txt', 'foo\n')

  fs.copyFileSync('test/fixtures/foo.txt', 'test/fixtures/bar.txt')

  fs.open('test/fixtures/foo.txt', (err, fd) => {
    t.absent(err, 'original copy opened')

    const data = Buffer.alloc(4)

    fs.read(fd, data, 0, 4, 0, (err, len) => {
      t.absent(err, 'read original copy')
      t.is(len, 4)
      t.alike(data, Buffer.from('foo\n'), 'check original copy content')

      fs.close(fd, (err) => {
        t.absent(err, 'original copy closed')
      })
    })
  })

  fs.open('test/fixtures/bar.txt', (err, fd) => {
    t.absent(err, 'new copy opened')

    const data = Buffer.alloc(4)

    fs.read(fd, data, 0, 4, 0, (err, len) => {
      t.absent(err, 'read new copy')
      t.is(len, 4)
      t.alike(data, Buffer.from('foo\n'), 'check new copy content')

      fs.close(fd, (err) => {
        t.absent(err, 'new copy closed')
      })
    })
  })
})

test('copyFile with COPYFILE_EXCL', async (t) => {
  t.plan(2)

  await withFile(t, 'test/fixtures/foo.txt', 'foo\n')
  await withFile(t, 'test/fixtures/bar.txt', 'bar\n')

  fs.copyFile(
    'test/fixtures/foo.txt',
    'test/fixtures/bar.txt',
    fs.constants.COPYFILE_EXCL,
    (err) => {
      t.ok(err)
      t.is(err.code, 'EEXIST')
    }
  )
})

test('copyFileSync with COPYFILE_EXCL', async (t) => {
  t.plan(1)

  await withFile(t, 'test/fixtures/foo.txt', 'foo\n')
  await withFile(t, 'test/fixtures/bar.txt', 'bar\n')

  t.exception(
    () =>
      fs.copyFileSync('test/fixtures/foo.txt', 'test/fixtures/bar.txt', fs.constants.COPYFILE_EXCL),
    /file already exists/
  )
})

test('cp', async (t) => {
  t.plan(11)

  await withDir(t, 'test/fixtures/dir/foo/bar/baz')
  await withFile(t, 'test/fixtures/dir/foo/bar/baz/foo.txt', 'foo\n')

  await withDir(t, 'test/fixtures/dir2', false)

  fs.cp('test/fixtures/dir', 'test/fixtures/dir2', { recursive: true }, (err) => {
    t.absent(err, 'directory copied')

    fs.open('test/fixtures/dir/foo/bar/baz/foo.txt', (err, fd) => {
      t.absent(err, 'original copy opened')

      const data = Buffer.alloc(4)

      fs.read(fd, data, 0, 4, 0, (err, len) => {
        t.absent(err, 'read original copy')
        t.is(len, 4)
        t.alike(data, Buffer.from('foo\n'), 'check original copy content')

        fs.close(fd, (err) => {
          t.absent(err, 'original copy closed')
        })
      })
    })

    fs.open('test/fixtures/dir2/foo/bar/baz/foo.txt', (err, fd) => {
      t.absent(err, 'new copy opened')

      const data = Buffer.alloc(4)

      fs.read(fd, data, 0, 4, 0, (err, len) => {
        t.absent(err, 'read new copy')
        t.is(len, 4)
        t.alike(data, Buffer.from('foo\n'), 'check new copy content')

        fs.close(fd, (err) => {
          t.absent(err, 'new copy closed')
        })
      })
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

test('createReadStream', async (t) => {
  t.plan(1)

  const expected = crypto.randomBytes(1024 * 16 /* 16 KiB */)

  const file = await withFile(t, 'test/fixtures/foo', expected)

  const stream = fs.createReadStream(file)
  const read = []

  stream
    .on('data', (data) => read.push(data))
    .on('end', () => t.alike(Buffer.concat(read), expected))
})

test('createReadStream, large file', async (t) => {
  t.plan(1)

  const expected = crypto.randomBytes(1024 * 512 /* 512 KiB */)

  const file = await withFile(t, 'test/fixtures/foo', expected)

  const stream = fs.createReadStream(file)
  const read = []

  stream
    .on('data', (data) => read.push(data))
    .on('end', () => t.alike(Buffer.concat(read), expected))
})

test('createWriteStream', async (t) => {
  t.plan(2)

  const file = await withFile(t, 'test/fixtures/foo')

  const stream = fs.createWriteStream(file)

  stream.on('close', () =>
    fs.readFile(file, (err, data) => {
      t.absent(err)
      t.alike(data, Buffer.from('hello world'))
    })
  )

  stream.write('hello')
  stream.end(' world')
})

async function withFile(t, path, data = Buffer.alloc(0), opts = {}) {
  if (data) await fs.promises.writeFile(path, data, opts)

  t.teardown(() => fs.promises.rm(path, { force: true }))

  return path
}

async function withSymlink(t, path, target = false) {
  if (target) {
    try {
      await fs.promises.rm(path)
    } catch {}

    await fs.promises.symlink(target, path)
  }

  t.teardown(() => fs.promises.rm(path, { force: true }))

  return path
}

async function withDir(t, path, create = true) {
  if (create) await fs.promises.mkdir(path, { recursive: true })

  t.teardown(() => fs.promises.rm(path, { force: true, recursive: true }))

  return path
}
