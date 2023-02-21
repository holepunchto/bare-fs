const test = require('brittle')
const path = require('path')
const fsnode = require('fs')
const { createFolder } = require('./helpers')
const fs = require('../index.js')
const b4a = require('b4a')

test('write file', function (t) {
  t.plan(3)

  const root = createFolder(t)
  const filename = path.join(root, 'NEW-LICENSE')

  t.absent(fsnode.existsSync(filename))

  fs.writeFile(filename, b4a.from('ISC'), function (err) {
    t.is(err, null)
    t.alike(fsnode.readFileSync(filename), b4a.from('ISC'))
  })
})

test('write file with encoding', function (t) {
  t.plan(4)

  const root = createFolder(t)

  fs.writeFile(path.join(root, 'NEW-LICENSE'), 'ISC', 'utf-8', function (err) {
    t.is(err, null)
    t.alike(fsnode.readFileSync(path.join(root, 'NEW-LICENSE')), b4a.from('ISC'))
  })

  fs.writeFile(path.join(root, 'ANOTHER-NEW-LICENSE'), b4a.from('ISC').toString('hex'), 'hex', function (err) {
    t.is(err, null)
    t.alike(fsnode.readFileSync(path.join(root, 'ANOTHER-NEW-LICENSE')), b4a.from('ISC'))
  })
})

test('write file that already exists', function (t) {
  t.plan(2)

  const root = createFolder(t)

  fs.writeFile(path.join(root, 'LICENSE'), 'ISC', function (err) {
    t.is(err, null)
    t.alike(fsnode.readFileSync(path.join(root, 'LICENSE')), b4a.from('ISC'))
  })
})

test('write file with encoding option', function (t) {
  t.plan(2)

  const root = createFolder(t)

  fs.writeFile(path.join(root, 'NEW-LICENSE'), b4a.from('ISC').toString('hex'), { encoding: 'hex' }, function (err) {
    t.is(err, null)
    t.alike(fsnode.readFileSync(path.join(root, 'NEW-LICENSE')), b4a.from('ISC'))
  })
})

test('read file with non-existing encoding', function (t) {
  t.plan(1)

  const root = createFolder(t)

  try {
    fs.writeFile(path.join(root, 'NEW-LICENSE'), 'ISC', { encoding: 'not-exists' }, function () {
      t.fail('callback should not be called')
    })
  } catch (error) {
    t.is(error.code, 'ERR_UNKNOWN_ENCODING') // + it should be "ERR_INVALID_ARG_VALUE"
  }
})

test('write file with an object', function (t) {
  t.plan(1)

  const root = createFolder(t)

  try {
    fsnode.writeFile(path.join(root, 'NEW-LICENSE'), { message: 'hello' }, function () {
      t.fail('callback should not be called')
    })
  } catch (error) {
    t.is(error.code, 'ERR_INVALID_ARG_TYPE')
  }
})

test('write file but it is a folder', function (t) {
  t.plan(1)

  const root = createFolder(t)

  fs.writeFile(path.join(root, 'examples'), 'ISC', function (err) {
    t.is(err.code, 'EISDIR')
  })
})

test('write file with flags', function (t) {
  t.plan(2)

  const root = createFolder(t)

  fs.writeFile(path.join(root, 'LICENSE'), '+ISC', { flag: 'a+' }, function (err) {
    t.is(err, null)
    t.alike(fsnode.readFileSync(path.join(root, 'LICENSE')), b4a.from('MIT+ISC'))
  })
})

test('write file with no callback', function (t) {
  t.plan(5)

  const root = createFolder(t)

  try {
    fs.writeFile()
  } catch (error) {
    t.is(error.code, 'ERR_INVALID_ARG_TYPE')
  }

  try {
    fs.writeFile(function () {})
  } catch (error) {
    t.is(error.code, 'ERR_INVALID_ARG_TYPE')
  }

  try {
    fs.writeFile(path.join(root, 'LICENSE'))
  } catch (error) {
    t.is(error.code, 'ERR_INVALID_ARG_TYPE')
  }

  try {
    fs.writeFile(path.join(root, 'LICENSE'), { flag: 'w+' })
  } catch (error) {
    t.is(error.code, 'ERR_INVALID_ARG_TYPE')
  }

  try {
    fs.writeFile(path.join(root, 'LICENSE'), { flag: 'w+' }, true)
  } catch (error) {
    t.is(error.code, 'ERR_INVALID_ARG_TYPE')
  }
})
