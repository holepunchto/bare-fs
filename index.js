const binding = require('./binding')
const { Readable, Writable } = require('streamx')
const b4a = require('b4a')

const LE = (new Uint8Array(new Uint16Array([255]).buffer))[0] === 0xff
const ERRORS = new Map(binding.uv_error_map)

const sep = exports.sep = binding.IS_WINDOWS ? '\\' : '/'

const constants = exports.constants = {
  O_RDWR: binding.O_RDWR,
  O_RDONLY: binding.O_RDONLY,
  O_WRONLY: binding.O_WRONLY,
  O_CREAT: binding.O_CREAT,
  O_TRUNC: binding.O_TRUNC,
  O_APPEND: binding.O_APPEND,
  S_IFMT: binding.S_IFMT,
  S_IFREG: binding.S_IFREG,
  S_IFDIR: binding.S_IFDIR,
  S_IFCHR: binding.S_IFCHR,
  S_IFLNK: binding.S_IFLNK,
  S_IFBLK: binding.S_IFBLK || 0,
  S_IFIFO: binding.S_IFIFO || 0,
  S_IFSOCK: binding.S_IFSOCK || 0
}

const reqs = []
let used = 0

const fs = {
  handle: b4a.allocUnsafe(binding.sizeof_pear_fs_t)
}

binding.pear_fs_init(fs.handle, fs, onfsresponse)

process.on('exit', () => binding.pear_fs_destroy(fs.handle))

// Lightly-modified from the Node FS internal utils.
function flagsToNumber (flags) {
  switch (flags) {
    case 'r' : return constants.O_RDONLY
    case 'rs' : // Fall through.
    case 'sr' : return constants.O_RDONLY | constants.O_SYNC
    case 'r+' : return constants.O_RDWR
    case 'rs+' : // Fall through.
    case 'sr+' : return constants.O_RDWR | constants.O_SYNC

    case 'w' : return constants.O_TRUNC | constants.O_CREAT | constants.O_WRONLY
    case 'wx' : // Fall through.
    case 'xw' : return constants.O_TRUNC | constants.O_CREAT | constants.O_WRONLY | constants.O_EXCL

    case 'w+' : return constants.O_TRUNC | constants.O_CREAT | constants.O_RDWR
    case 'wx+': // Fall through.
    case 'xw+': return constants.O_TRUNC | constants.O_CREAT | constants.O_RDWR | constants.O_EXCL

    case 'a' : return constants.O_APPEND | constants.O_CREAT | constants.O_WRONLY
    case 'ax' : // Fall through.
    case 'xa' : return constants.O_APPEND | constants.O_CREAT | constants.O_WRONLY | constants.O_EXCL
    case 'as' : // Fall through.
    case 'sa' : return constants.O_APPEND | constants.O_CREAT | constants.O_WRONLY | constants.O_SYNC

    case 'a+' : return constants.O_APPEND | constants.O_CREAT | constants.O_RDWR
    case 'ax+': // Fall through.
    case 'xa+': return constants.O_APPEND | constants.O_CREAT | constants.O_RDWR | constants.O_EXCL
    case 'as+': // Fall through.
    case 'sa+': return constants.O_APPEND | constants.O_CREAT | constants.O_RDWR | constants.O_SYNC
  }

  throw typeError('ERR_INVALID_ARG_VALUE', `Invalid value in flags: ${flags}`)
}

function modeToNumber (mode) {
  mode = parseInt(mode, 8)
  if (isNaN(mode)) throw typeError('ERR_INVALID_ARG_VALUE', 'Mode must be a number or octal string')
  return mode
}

function alloc () {
  const handle = b4a.alloc(binding.sizeof_pear_fs_req_t)

  binding.pear_fs_req_init(fs.handle, handle)

  const view = new Uint32Array(handle.buffer, handle.byteOffset + binding.offsetof_pear_fs_req_t_id, 1)

  view[0] = reqs.length

  const req = {
    handle,
    view,
    type: 0,
    buffer: null,
    buffers: null,
    callback: null
  }

  used++
  reqs.push(req)
  return req
}

function getReq () {
  return used === reqs.length ? alloc() : reqs[used++]
}

function onfsresponse (id, result) {
  const req = reqs[id]
  used--

  if (used !== id) {
    const u = reqs[used]
    reqs[u.view[0] = id] = u
    reqs[req.view[0] = used] = req
  }

  const callback = req.callback
  const buffer = req.buffer
  const buffers = req.buffers

  req.callback = null
  req.buffer = null
  req.buffers = null

  if (result < 0) {
    callback(createError(result), result, null)
  } else {
    callback(null, result, buffer || buffers)
  }
}

function createError (errno) {
  const [code, desc] = ERRORS.get(errno)
  const err = new Error(code + ': ' + desc)

  err.errno = errno
  err.code = code

  return err
}

function write (fd, buf, offset, len, pos, cb) {
  if (typeof cb === 'function') {
    const req = getReq()

    req.buffer = buf
    req.callback = cb

    const low = pos === null ? 0xffffffff : ((pos & 0xffffffff) >>> 0)
    const high = pos === null ? 0xffffffff : (pos - low) / 0x100000000

    binding.pear_fs_write(req.handle, fd, buf, offset, len, low, high)
    return
  }

  if (typeof offset === 'function') return write(fd, buf, 0, buf.byteLength, null, offset)
  if (typeof len === 'function') return write(fd, buf, offset, buf.byteLength - offset, null, len)
  if (typeof pos === 'function') return write(fd, buf, offset, len, null, pos)

  throw typeError('ERR_INVALID_ARG_TYPE', 'Callback must be a function. Received ' + cb)
}

function writeSync (fd, buf, offset = 0, len = buf.byteLength, pos = null) {
  const low = pos === null ? 0xffffffff : ((pos & 0xffffffff) >>> 0)
  const high = pos === null ? 0xffffffff : (pos - low) / 0x100000000

  return binding.pear_fs_write_sync(fd, buf, offset, len, low, high)
}

function writev (fd, buffers, pos, cb) {
  if (typeof pos === 'function') {
    cb = pos
    pos = null
  }

  const req = getReq()

  req.buffers = buffers
  req.callback = cb

  const low = pos === null ? 0xffffffff : ((pos & 0xffffffff) >>> 0)
  const high = pos === null ? 0xffffffff : (pos - low) / 0x100000000

  binding.pear_fs_writev(req.handle, fd, buffers, low, high)
}

function read (fd, buf, offset, len, pos, cb) {
  if (typeof cb === 'function') {
    const req = getReq()

    req.buffer = buf
    req.callback = cb

    const low = pos === null ? 0xffffffff : ((pos & 0xffffffff) >>> 0)
    const high = pos === null ? 0xffffffff : (pos - low) / 0x100000000

    binding.pear_fs_read(req.handle, fd, buf, offset, len, low, high)
    return
  }

  if (typeof offset === 'function') return read(fd, buf, 0, buf.byteLength, null, offset)
  if (typeof len === 'function') return read(fd, buf, offset, buf.byteLength - offset, null, len)
  if (typeof pos === 'function') return read(fd, buf, offset, len, null, pos)

  throw typeError('ERR_INVALID_ARG_TYPE', 'Callback must be a function. Received ' + cb)
}

function readSync (fd, buf, offset = 0, len = buf.byteLength, pos = null) {
  const low = pos === null ? 0xffffffff : ((pos & 0xffffffff) >>> 0)
  const high = pos === null ? 0xffffffff : (pos - low) / 0x100000000

  return binding.pear_fs_read_sync(fd, buf, offset, len, low, high)
}

function readv (fd, buffers, pos, cb) {
  if (typeof pos === 'function') {
    cb = pos
    pos = null
  }

  const req = getReq()

  req.buffers = buffers
  req.callback = cb

  const low = pos === null ? 0xffffffff : ((pos & 0xffffffff) >>> 0)
  const high = pos === null ? 0xffffffff : (pos - low) / 0x100000000

  binding.pear_fs_readv(req.handle, fd, buffers, low, high)
}

function open (filename, flags = 'r', mode = 0o666, cb) {
  if (typeof filename !== 'string') throw typeError('ERR_INVALID_ARG_TYPE', 'Path must be a string. Received ' + filename)

  if (typeof flags === 'function') return open(filename, undefined, undefined, flags)
  if (typeof mode === 'function') return open(filename, flags, undefined, mode)

  if (typeof cb !== 'function') throw typeError('ERR_INVALID_ARG_TYPE', 'Callback must be a function. Received ' + cb)

  if (typeof flags === 'string') flags = flagsToNumber(flags)
  if (typeof mode === 'string') mode = modeToNumber(mode)

  const req = getReq()

  req.callback = cb
  binding.pear_fs_open(req.handle, filename, flags, mode)
}

function openSync (filename, flags = 'r', mode = 0o666) {
  if (typeof filename !== 'string') throw typeError('ERR_INVALID_ARG_TYPE', 'Path must be a string. Received ' + filename)

  if (typeof flags === 'string') flags = flagsToNumber(flags)
  if (typeof mode === 'string') mode = modeToNumber(mode)

  const res = binding.pear_fs_open_sync(filename, flags, mode)

  if (res < 0) throw createError(res)
  return res
}

function close (fd, cb = noop) {
  if (typeof fd !== 'number') throw typeError('ERR_INVALID_ARG_TYPE', 'File descriptor must be a number. Received type ' + (typeof fd) + ' (' + fd + ')')
  if (typeof cb !== 'function') throw typeError('ERR_INVALID_ARG_TYPE', 'Callback must be a function. Received type ' + (typeof cb) + ' (' + cb + ')')
  if (!(fd >= 0 && fd <= 0x7fffffff)) throw typeError('ERR_OUT_OF_RANGE', 'File descriptor is out of range. It must be >= 0 && <= 2147483647. Received ' + fd)

  const req = getReq()

  req.callback = cb
  binding.pear_fs_close(req.handle, fd)
}

function closeSync (fd) {
  const res = binding.pear_fs_close_sync(fd)

  if (res < 0) throw createError(res)
  return res
}

function ftruncate (fd, len, cb) {
  const req = getReq()

  const low = (len & 0xffffffff) >>> 0
  const high = (len - low) / 0x100000000

  req.callback = cb
  binding.pear_fs_ftruncate(req.handle, fd, low, high)
}

class Stats {
  constructor (buf) {
    const view = new Uint32Array(buf.buffer, buf.byteOffset, 32)

    this.dev = toNumber(view, 0)
    this.mode = toNumber(view, 2)
    this.nlink = toNumber(view, 4)
    this.uid = toNumber(view, 6)
    this.gid = toNumber(view, 8)
    this.rdev = toNumber(view, 10)
    this.ino = toNumber(view, 12)
    this.size = toNumber(view, 14)
    this.blksize = toNumber(view, 16)
    this.blocks = toNumber(view, 18)
    this.flags = toNumber(view, 20)
    this.gen = toNumber(view, 22)
    this.atimeMs = toNumber(view, 24)
    this.mtimeMs = toNumber(view, 26)
    this.ctimeMs = toNumber(view, 28)
    this.birthtimeMs = toNumber(view, 30)
    this.atime = new Date(this.atimeMs)
    this.mtime = new Date(this.mtimeMs)
    this.ctime = new Date(this.ctimeMs)
    this.birthtime = new Date(this.birthtimeMs)
  }

  isDirectory () {
    return (this.mode & constants.S_IFDIR) !== 0
  }

  isFile () {
    return (this.mode & constants.S_IFREG) !== 0
  }

  isBlockDevice () {
    return (this.mode & constants.S_IFBLK) !== 0
  }

  isCharacterDevice () {
    return (this.mode & constants.S_IFCHR) !== 0
  }

  isFIFO () {
    return (this.mode & constants.S_IFIFO) !== 0
  }

  isSymbolicLink () {
    return (this.mode & constants.S_IFLNK) !== 0
  }

  isSocket () {
    return (this.mode & constants.S_IFSOCK) !== 0
  }
}

function toNumber (view, n) {
  return LE ? view[n] + view[n + 1] * 0x100000000 : view[n] * 0x100000000 + view[n + 1]
}

function stat (path, cb) {
  const req = getReq()

  req.buffer = b4a.allocUnsafe(16 * 8)

  req.callback = function (err, _, buf) {
    if (err) cb(err, null)
    else cb(null, new Stats(buf))
  }

  binding.pear_fs_stat(req.handle, path, req.buffer)
}

function statSync (path) {
  const buffer = b4a.allocUnsafe(16 * 8)
  const res = binding.pear_fs_stat_sync(path, buffer)
  if (res < 0) throw createError(res)
  return new Stats(buffer)
}

function lstat (path, cb) {
  const req = getReq()

  req.buffer = b4a.allocUnsafe(16 * 8)

  req.callback = function (err, _, buf) {
    if (err) cb(err, null)
    else cb(null, new Stats(buf))
  }

  binding.pear_fs_lstat(req.handle, path, req.buffer)
}

function lstatSync (path) {
  const buffer = b4a.allocUnsafe(16 * 8)
  const res = binding.pear_fs_lstat_sync(path, buffer)
  if (res < 0) throw createError(res)
  return new Stats(buffer)
}

function fstat (fd, cb) {
  const req = getReq()

  req.buffer = b4a.allocUnsafe(16 * 8)

  req.callback = function (err, _, buf) {
    if (err) cb(err, null)
    else cb(null, new Stats(buf))
  }

  binding.pear_fs_fstat(req.handle, fd, req.buffer)
}

function fstatSync (fd) {
  const buffer = b4a.allocUnsafe(16 * 8)
  const res = binding.pear_fs_fstat_sync(fd, buffer)
  if (res < 0) throw createError(res)
  return new Stats(buffer)
}

function mkdirp (path, mode, cb) {
  mkdir(path, { mode }, function (err) {
    if (err === null) return cb(null, 0, null)

    if (err.errno !== binding.UV_ENOENT) {
      stat(path, function (e, st) {
        if (e) return cb(e, e.errno, null)
        if (st.isDirectory()) return cb(null, 0, null)
        cb(err, err.errno, null)
      })
      return
    }

    while (path.endsWith(sep)) path = path.slice(0, -1)
    const i = path.lastIndexOf(sep)
    if (i <= 0) return cb(err, err.errno, null)

    mkdirp(path.slice(0, i), mode, function (err) {
      if (err) return cb(err, err.errno, null)
      mkdir(path, { mode }, cb)
    })
  })
}

function rename (src, dst, cb) {
  const req = getReq()

  req.callback = cb
  binding.pear_fs_rename(req.handle, src, dst)
}

function mkdir (path, opts, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = { mode: 0o777 }
  }

  if (!opts) opts = {}

  const mode = typeof opts.mode === 'number' ? opts.mode : 0o777

  if (opts.recursive) {
    return mkdirp(path, mode, cb)
  }

  const req = getReq()

  req.callback = cb
  binding.pear_fs_mkdir(req.handle, path, mode)
}

function rmdir (path, cb) {
  const req = getReq()

  req.callback = cb
  binding.pear_fs_rmdir(req.handle, path)
}

function unlink (path, cb) {
  const req = getReq()

  req.callback = cb
  binding.pear_fs_unlink(req.handle, path)
}

function readFile (path, opts, cb) {
  if (typeof opts === 'function') return readFile(path, null, opts)
  if (typeof cb !== 'function') throw typeError('ERR_INVALID_ARG_TYPE', 'Callback must be a function')
  if (typeof opts === 'string') opts = { encoding: opts }
  if (!opts) opts = {}

  open(path, opts.flag || 'r', function (err, fd) {
    if (err) return cb(err)

    fstat(fd, function (err, st) {
      if (err) return closeAndError(err)

      let buf = b4a.allocUnsafe(st.size)
      let len = 0

      read(fd, buf, loop)

      function loop (err, r) {
        if (err) return closeAndError(err)
        len += r
        if (r === 0 || len === buf.byteLength) return done()
        read(fd, buf.subarray(len), loop)
      }

      function done () {
        if (len !== buf.byteLength) buf = buf.subarray(0, len)
        close(fd, function (err) {
          if (err) return cb(err)
          if (opts.encoding) return cb(null, b4a.toString(buf, opts.encoding))
          return cb(null, buf)
        })
      }
    })

    function closeAndError (err) {
      close(fd, function () {
        cb(err)
      })
    }
  })
}

function readFileSync (path, opts) {
  if (typeof opts === 'string') opts = { encoding: opts }
  if (!opts) opts = {}

  const fd = openSync(path, opts.flag || 'r')

  try {
    const st = fstatSync(fd)

    let buf = b4a.allocUnsafe(st.size)
    let len = 0

    while (true) {
      const r = readSync(fd, len ? buf.subarray(len) : buf)
      len += r
      if (r === 0 || len === buf.byteLength) break
    }
    if (len !== buf.byteLength) buf = buf.subarray(0, len)

    if (opts.encoding) return b4a.toString(buf, opts.encoding)
    return buf
  } finally {
    try {
      closeSync(fd)
    } catch {}
  }
}

function writeFile (path, data, opts, cb) {
  if (typeof opts === 'function') return writeFile(path, data, null, opts)
  if (typeof cb !== 'function') throw typeError('ERR_INVALID_ARG_TYPE', 'Callback must be a function')
  if (typeof data !== 'string' && !b4a.isBuffer(data)) throw typeError('ERR_INVALID_ARG_TYPE', 'The data argument must be of type string or buffer')
  if (typeof opts === 'string') opts = { encoding: opts }
  if (!opts) opts = {}

  if (opts.encoding || typeof data === 'string') {
    data = b4a.from(data, opts.encoding)
  }

  open(path, opts.flag || 'w', opts.mode, function (err, fd) {
    if (err) return cb(err)

    write(fd, data, loop)

    function loop (err, w, data) {
      if (err) return closeAndError(err)
      if (w === data.byteLength) return done()
      write(fd, data.subarray(w), loop)
    }

    function done () {
      close(fd, function (err) {
        if (err) return cb(err)
        return cb(null)
      })
    }

    function closeAndError (err) {
      close(fd, function () {
        cb(err)
      })
    }
  })
}

function writeFileSync (path, buf, opts) {
  if (typeof opts === 'string') opts = { encoding: opts }
  if (!opts) opts = {}

  if (opts.encoding || typeof buf === 'string') {
    buf = b4a.from(buf, opts.encoding)
  }

  const fd = openSync(path, opts.flag || 'w', opts.mode)

  try {
    let len = 0
    while (true) {
      len += writeSync(fd, len ? buf.subarray(len) : buf)
      if (len === buf.byteLength) break
    }
  } finally {
    try {
      closeSync(fd)
    } catch {}
  }
}

class FileWriteStream extends Writable {
  constructor (path, opts = {}) {
    super({ map })

    this.path = path
    this.fd = 0
    this.flags = opts.flags || 'w'
    this.mode = opts.mode || 0o666
  }

  _open (cb) {
    open(this.path, this.flags, this.mode, (err, fd) => {
      if (err) return cb(err)
      this.fd = fd
      cb(null)
    })
  }

  _writev (datas, cb) {
    writev(this.fd, datas, cb)
  }

  _destroy (cb) {
    if (!this.fd) return cb(null)
    close(this.fd, () => cb(null))
  }
}

class FileReadStream extends Readable {
  constructor (path, opts = {}) {
    super()

    this.path = path
    this.fd = 0

    this._offset = opts.start || 0
    this._missing = 0

    if (opts.length) this._missing = opts.length
    else if (typeof opts.end === 'number') this._missing = opts.end - this._offset + 1
    else this._missing = -1
  }

  _open (cb) {
    open(this.path, constants.O_RDONLY, (err, fd) => {
      if (err) return cb(err)

      const onerror = (err) => close(fd, () => cb(err))

      fstat(fd, (err, st) => {
        if (err) return onerror(err)
        if (!st.isFile()) return onerror(new Error(this.path + ' is not a file'))

        this.fd = fd
        if (this._missing === -1) this._missing = st.size

        if (st.size < this._offset) {
          this._offset = st.size
          this._missing = 0
          return cb(null)
        }
        if (st.size < this._offset + this._missing) {
          this._missing = st.size - this._offset
          return cb(null)
        }

        cb(null)
      })
    })
  }

  _read (cb) {
    if (!this._missing) {
      this.push(null)
      return cb(null)
    }

    const data = b4a.allocUnsafe(Math.min(this._missing, 65536))

    read(this.fd, data, 0, data.byteLength, this._offset, (err, read) => {
      if (err) return cb(err)

      if (!read) {
        this.push(null)
        return cb(null)
      }

      if (this._missing < read) read = this._missing
      this.push(data.subarray(0, read))
      this._missing -= read
      this._offset += read
      if (!this._missing) this.push(null)

      cb(null)
    })
  }

  _destroy (cb) {
    if (!this.fd) return cb(null)
    close(this.fd, () => cb(null))
  }
}

exports.promises = {}

function typeError (code, message) {
  const error = new TypeError(message)
  error.code = code
  return error
}

function noop () {}

exports.open = open
exports.close = close
exports.read = read
exports.readv = readv
exports.write = write
exports.writev = writev
exports.ftruncate = ftruncate
exports.fstat = fstat

exports.openSync = openSync
exports.closeSync = closeSync
exports.readSync = readSync
exports.writeSync = writeSync
exports.fstatSync = fstatSync
exports.statSync = statSync
exports.lstatSync = lstatSync

exports.readFileSync = readFileSync
exports.writeFileSync = writeFileSync

exports.unlink = unlink
exports.promises.unlink = promisify(unlink)

exports.readFile = readFile
exports.promises.readFile = promisify(readFile)

exports.writeFile = writeFile
exports.promises.writeFile = promisify(writeFile)

exports.rename = rename
exports.promises.rename = promisify(rename)

exports.mkdir = mkdir
exports.promises.mkdir = promisify(mkdir)

exports.rmdir = rmdir
exports.promises.rmdir = promisify(rmdir)

exports.Stats = Stats // for compat

exports.stat = stat
exports.promises.stat = promisify(stat)

exports.lstat = lstat
exports.promises.lstat = promisify(lstat)

exports.ReadStream = FileReadStream
exports.createReadStream = (path, options) => new FileReadStream(path, options)

exports.WriteStream = FileWriteStream
exports.createWriteStream = (path, options) => new FileWriteStream(path, options)

function promisify (fn) {
  return function (...args) {
    return new Promise((resolve, reject) => {
      fn(...args, function (err, res) {
        if (err) return reject(err)
        resolve(res)
      })
    })
  }
}

function map (s) {
  return typeof s === 'string' ? b4a.from(s) : s
}
