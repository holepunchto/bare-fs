const test = require('brittle')
const path = require('path')
const fsnode = require('fs')
const { createFolder } = require('./helpers')
const fs = require('../index.js')
const b4a = require('b4a')

const isWin = process.platform === 'win32'

test('open', function (t) {
  t.plan(2)

  const root = createFolder(t)

  fs.open(path.join(root, 'LICENSE'), function (err, fd) {
    t.is(err, null)
    t.is(typeof fd, 'number')

    fsnode.closeSync(fd)
  })
})

test('open with flags', function (t) {
  t.plan(4)

  const root = createFolder(t)

  fs.open(path.join(root, 'LICENSE'), 'w+', function (err, fd) {
    t.is(err, null)
    t.is(typeof fd, 'number')

    const data = b4a.alloc(32)
    const bytesRead = fsnode.readSync(fd, data, 0, data.byteLength)

    t.alike(data, b4a.alloc(32)) // empty means that w+ flags had effect
    t.is(bytesRead, 0)

    fsnode.closeSync(fd)
  })
})

test('open new file with mode', function (t) {
  t.plan(6)

  const root = createFolder(t)

  fs.open(path.join(root, 'NEW-LICENSE'), 'wx', 0o655, function (err, fd) {
    t.is(err, null)
    t.is(typeof fd, 'number')

    t.is(fsnode.fstatSync(fd).mode, isWin ? 33206 : 33197) // => 0o655
    fsnode.closeSync(fd)
  })

  fs.open(path.join(root, 'NEW-LICENSE-TWO'), 'wx', 0o755, function (err, fd) {
    t.is(err, null)
    t.is(typeof fd, 'number')

    t.is(fsnode.fstatSync(fd).mode, isWin ? 33206 : 33261) // => 0o755
    fsnode.closeSync(fd)
  })
})

test('open new file with mode as octal string', function (t) {
  t.plan(3)

  const root = createFolder(t)

  fs.open(path.join(root, 'NEW-LICENSE'), 'wx', '755', function (err, fd) {
    t.is(err, null)
    t.is(typeof fd, 'number')

    t.is(fsnode.fstatSync(fd).mode, isWin ? 33206 : 33261) // => 0o755
    fsnode.closeSync(fd)
  })
})

test('open with invalid flags', function (t) {
  t.plan(1)

  const root = createFolder(t)

  try {
    fs.open(path.join(root, 'NEW-LICENSE'), 'wrong', function () {
      t.fail('callback should not be called')
    })
  } catch (error) {
    t.is(error.code, 'ERR_INVALID_ARG_VALUE')
  }
})

test('open with invalid mode', function (t) {
  t.plan(1)

  const root = createFolder(t)

  try {
    fs.open(path.join(root, 'NEW-LICENSE'), 'wx', 'wrong755', function () {
      t.fail('callback should not be called')
    })
  } catch (error) {
    t.is(error.code, 'ERR_INVALID_ARG_VALUE')
  }
})

test.skip('open non-existing file', function (t) {
  t.plan(2)

  const root = createFolder(t)

  fs.open(path.join(root, 'not-exists.txt'), function (err, fd) {
    t.is(err.code, 'ENOENT')
    t.is(fd, undefined)
  })
})

test('open but it is a folder', function (t) {
  t.plan(2)

  const root = createFolder(t)

  fs.open(path.join(root, 'examples'), function (err, fd) {
    t.is(err, null)
    t.is(typeof fd, 'number')

    fsnode.closeSync(fd)
  })
})

test('open with no callback', function (t) {
  t.plan(6)

  const root = createFolder(t)

  try {
    fs.open()
  } catch (error) {
    t.is(error.code, 'ERR_INVALID_ARG_TYPE')
  }

  try {
    fs.open(function () {})
  } catch (error) {
    t.is(error.code, 'ERR_INVALID_ARG_TYPE')
  }

  try {
    fs.open(path.join(root, 'LICENSE'))
  } catch (error) {
    t.is(error.code, 'ERR_INVALID_ARG_TYPE')
  }

  try {
    fs.open(path.join(root, 'LICENSE'), 'r')
  } catch (error) {
    t.is(error.code, 'ERR_INVALID_ARG_TYPE')
  }

  try {
    fs.open(path.join(root, 'LICENSE'), 'r', 0o666)
  } catch (error) {
    t.is(error.code, 'ERR_INVALID_ARG_TYPE')
  }

  try {
    fs.open(path.join(root, 'LICENSE'), 'r', 0o666, true)
  } catch (error) {
    t.is(error.code, 'ERR_INVALID_ARG_TYPE')
  }
})
