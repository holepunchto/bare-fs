const test = require('brittle')
const path = require('path')
const fsnode = require('fs')
const { createFolder } = require('./helpers')
const fs = require('../index.js')
const b4a = require('b4a')

test('close', function (t) {
  t.plan(3)

  const root = createFolder(t)

  fs.open(path.join(root, 'LICENSE'), function (err, fd) {
    t.is(err, null)

    fs.close(fd, function (err) {
      t.is(err, null)

      try {
        fsnode.readSync(fd, b4a.alloc(32))
        t.fail('should have failed')
      } catch (error) {
        t.is(error.code, 'EBADF')
      }
    })
  })
})

test('close fd already closed', function (t) {
  t.plan(3)

  const root = createFolder(t)

  fs.open(path.join(root, 'LICENSE'), function (err, fd) {
    t.is(err, null)

    fs.close(fd, function (err) {
      t.is(err, null)

      fs.close(fd, function (err) {
        t.is(err.code, 'EBADF')
      })
    })
  })
})

test('close invalid fd', function (t) {
  t.plan(2)

  try {
    fs.close(-5, function () {
      t.fail('callback should not be called')
    })
  } catch (error) {
    t.is(error.code, 'ERR_OUT_OF_RANGE')
  }

  try {
    fs.close('123', function () {
      t.fail('callback should not be called')
    })
  } catch (error) {
    t.is(error.code, 'ERR_INVALID_ARG_TYPE')
  }
})

test('close with no callback', function (t) {
  t.plan(2)

  const root = createFolder(t)

  fs.open(path.join(root, 'LICENSE'), function (err, fd) {
    t.is(err, null)

    fs.close(fd)

    setImmediate(() => {
      setImmediate(() => {
        try {
          fsnode.readSync(fd, b4a.alloc(32))
          t.fail('should have failed')
        } catch (error) {
          t.is(error.code, 'EBADF')
        }
      })
    })
  })
})

test('close with wrong args', function (t) {
  t.plan(3)

  try {
    fs.close()
  } catch (error) {
    t.is(error.code, 'ERR_INVALID_ARG_TYPE')
  }

  try {
    fs.close(function () {})
  } catch (error) {
    t.is(error.code, 'ERR_INVALID_ARG_TYPE')
  }

  try {
    fs.close(0, true)
  } catch (error) {
    t.is(error.code, 'ERR_INVALID_ARG_TYPE')
  }
})
