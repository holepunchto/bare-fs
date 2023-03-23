const test = require('brittle')
const fs = require('..')

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
