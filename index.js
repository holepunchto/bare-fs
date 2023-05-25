const { Readable, Writable } = require('streamx')
const binding = require('./binding')

const sep = process.platform === 'win32' ? '\\' : '/'

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
  S_IFSOCK: binding.S_IFSOCK || 0,

  UV_DIRENT_UNKNOWN: binding.UV_DIRENT_UNKNOWN,
  UV_DIRENT_FILE: binding.UV_DIRENT_FILE,
  UV_DIRENT_DIR: binding.UV_DIRENT_DIR,
  UV_DIRENT_LINK: binding.UV_DIRENT_LINK,
  UV_DIRENT_FIFO: binding.UV_DIRENT_FIFO,
  UV_DIRENT_SOCKET: binding.UV_DIRENT_SOCKET,
  UV_DIRENT_CHAR: binding.UV_DIRENT_CHAR,
  UV_DIRENT_BLOCK: binding.UV_DIRENT_BLOCK
}

const reqs = []
let used = 0

const fs = {
  handle: Buffer.allocUnsafe(binding.sizeofFS)
}

binding.init(fs.handle, fs, onresponse)

process.on('exit', () => binding.destroy(fs.handle))

if (process.thread) {
  process.thread.on('exit', () => binding.destroy(fs.handle))
}

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
  const handle = Buffer.alloc(binding.sizeofFSReq)

  binding.initReq(fs.handle, handle)

  const view = new Uint32Array(handle.buffer, handle.byteOffset + binding.offsetofFSReqID, 1)

  view[0] = reqs.length

  const req = {
    handle,
    view,
    type: 0,
    callback: null
  }

  used++
  reqs.push(req)
  return req
}

function getReq () {
  return used === reqs.length ? alloc() : reqs[used++]
}

function onresponse (id, result) {
  const req = reqs[id]
  used--

  if (used !== id) {
    const u = reqs[used]
    reqs[u.view[0] = id] = u
    reqs[req.view[0] = used] = req
  }

  const callback = req.callback

  req.callback = null

  if (result < 0) {
    callback(createError(result), result, null)
  } else {
    callback(null, result)
  }
}

function createError (errno) {
  const [code, message] = process.errnos.get(errno)
  const err = new Error(code + ': ' + message)

  err.errno = errno
  err.code = code

  return err
}

function open (path, flags, mode, cb) {
  if (typeof path !== 'string') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'Path must be a string. Received type ' + (typeof path) + ' (' + path + ')')
  }

  if (typeof cb !== 'function') {
    if (typeof flags === 'function') {
      cb = flags
      flags = 'r'
      mode = 0o666
    } else if (typeof mode === 'function') {
      cb = mode
      mode = 0o666
    } else {
      throw typeError('ERR_INVALID_ARG_TYPE', 'Callback must be a function. Received type ' + (typeof cb) + ' (' + cb + ')')
    }
  }

  if (typeof flags === 'string') flags = flagsToNumber(flags)
  if (typeof mode === 'string') mode = modeToNumber(mode)

  const req = getReq()
  req.callback = cb
  binding.open(req.handle, path, flags, mode)
}

function openSync (path, flags = 'r', mode = 0o666) {
  if (typeof path !== 'string') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'Path must be a string. Received type ' + (typeof path) + ' (' + path + ')')
  }

  if (typeof flags === 'string') flags = flagsToNumber(flags)
  if (typeof mode === 'string') mode = modeToNumber(mode)

  const res = binding.openSync(path, flags, mode)
  if (res < 0) throw createError(res)

  return res
}

function close (fd, cb = noop) {
  if (typeof fd !== 'number') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'File descriptor must be a number. Received type ' + (typeof fd) + ' (' + fd + ')')
  }

  if (fd < 0 || fd > 0x7fffffff) {
    throw typeError('ERR_OUT_OF_RANGE', 'File descriptor is out of range. It must be >= 0 && <= 2147483647. Received ' + fd)
  }

  if (typeof cb !== 'function') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'Callback must be a function. Received type ' + (typeof cb) + ' (' + cb + ')')
  }

  const req = getReq()
  req.callback = cb
  binding.close(req.handle, fd)
}

function closeSync (fd) {
  if (typeof fd !== 'number') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'File descriptor must be a number. Received type ' + (typeof fd) + ' (' + fd + ')')
  }

  if (fd < 0 || fd > 0x7fffffff) {
    throw typeError('ERR_OUT_OF_RANGE', 'File descriptor is out of range. It must be >= 0 && <= 2147483647. Received ' + fd)
  }

  const res = binding.closeSync(fd)
  if (res < 0) throw createError(res)

  return res
}

function read (fd, buffer, offset, len, pos, cb) {
  if (typeof fd !== 'number') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'File descriptor must be a number. Received type ' + (typeof fd) + ' (' + fd + ')')
  }

  if (fd < 0 || fd > 0x7fffffff) {
    throw typeError('ERR_OUT_OF_RANGE', 'File descriptor is out of range. It must be >= 0 && <= 2147483647. Received ' + fd)
  }

  if (!Buffer.isBuffer(buffer)) {
    throw typeError('ERR_INVALID_ARG_TYPE', 'Buffer must be a buffer. Received type ' + (typeof buffer) + ' (' + buffer + ')')
  }

  if (typeof cb !== 'function') {
    if (typeof offset === 'function') {
      cb = offset
      offset = 0
      len = buffer.byteLength
      pos = -1
    } else if (typeof len === 'function') {
      cb = len
      len = buffer.byteLength - offset
      pos = -1
    } else if (typeof pos === 'function') {
      cb = pos
      pos = -1
    } else {
      throw typeError('ERR_INVALID_ARG_TYPE', 'Callback must be a function. Received type ' + (typeof cb) + ' (' + cb + ')')
    }
  }

  if (typeof position !== 'number') pos = -1

  const req = getReq()
  req.callback = cb
  binding.read(req.handle, fd, buffer, offset, len, pos)
}

function readSync (fd, buffer, offset = 0, len = buffer.byteLength - offset, pos = -1) {
  if (typeof fd !== 'number') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'File descriptor must be a number. Received type ' + (typeof fd) + ' (' + fd + ')')
  }

  if (fd < 0 || fd > 0x7fffffff) {
    throw typeError('ERR_OUT_OF_RANGE', 'File descriptor is out of range. It must be >= 0 && <= 2147483647. Received ' + fd)
  }

  if (!Buffer.isBuffer(buffer)) {
    throw typeError('ERR_INVALID_ARG_TYPE', 'Buffer must be a buffer. Received type ' + (typeof buffer) + ' (' + buffer + ')')
  }

  return binding.readSync(fd, buffer, offset, len, pos)
}

function readv (fd, buffers, pos, cb) {
  if (typeof fd !== 'number') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'File descriptor must be a number. Received type ' + (typeof fd) + ' (' + fd + ')')
  }

  if (fd < 0 || fd > 0x7fffffff) {
    throw typeError('ERR_OUT_OF_RANGE', 'File descriptor is out of range. It must be >= 0 && <= 2147483647. Received ' + fd)
  }

  if (typeof pos === 'function') {
    cb = pos
    pos = -1
  } else if (typeof cb !== 'function') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'Callback must be a function. Received type ' + (typeof cb) + ' (' + cb + ')')
  }

  if (typeof position !== 'number') pos = -1

  const req = getReq()
  req.callback = cb
  binding.readv(req.handle, fd, buffers, pos)
}

function write (fd, buffer, offset, len, pos, cb) {
  if (typeof fd !== 'number') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'File descriptor must be a number. Received type ' + (typeof fd) + ' (' + fd + ')')
  }

  if (fd < 0 || fd > 0x7fffffff) {
    throw typeError('ERR_OUT_OF_RANGE', 'File descriptor is out of range. It must be >= 0 && <= 2147483647. Received ' + fd)
  }

  if (!Buffer.isBuffer(buffer)) {
    throw typeError('ERR_INVALID_ARG_TYPE', 'Buffer must be a buffer. Received type ' + (typeof buffer) + ' (' + buffer + ')')
  }

  if (typeof cb !== 'function') {
    if (typeof offset === 'function') {
      cb = offset
      offset = 0
      len = buffer.byteLength
      pos = -1
    } else if (typeof len === 'function') {
      cb = len
      len = buffer.byteLength - offset
      pos = -1
    } else if (typeof pos === 'function') {
      cb = pos
      pos = -1
    } else {
      throw typeError('ERR_INVALID_ARG_TYPE', 'Callback must be a function. Received type ' + (typeof cb) + ' (' + cb + ')')
    }
  }

  if (typeof position !== 'number') pos = -1

  const req = getReq()
  req.callback = cb
  binding.write(req.handle, fd, buffer, offset, len, pos)
}

function writeSync (fd, buffer, offset = 0, len = buffer.byteLength - offset, pos = -1) {
  if (typeof fd !== 'number') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'File descriptor must be a number. Received type ' + (typeof fd) + ' (' + fd + ')')
  }

  if (fd < 0 || fd > 0x7fffffff) {
    throw typeError('ERR_OUT_OF_RANGE', 'File descriptor is out of range. It must be >= 0 && <= 2147483647. Received ' + fd)
  }

  if (!Buffer.isBuffer(buffer)) {
    throw typeError('ERR_INVALID_ARG_TYPE', 'Buffer must be a buffer. Received type ' + (typeof buffer) + ' (' + buffer + ')')
  }

  return binding.writeSync(fd, buffer, offset, len, pos)
}

function writev (fd, buffers, pos, cb) {
  if (typeof fd !== 'number') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'File descriptor must be a number. Received type ' + (typeof fd) + ' (' + fd + ')')
  }

  if (fd < 0 || fd > 0x7fffffff) {
    throw typeError('ERR_OUT_OF_RANGE', 'File descriptor is out of range. It must be >= 0 && <= 2147483647. Received ' + fd)
  }

  if (typeof pos === 'function') {
    cb = pos
    pos = -1
  } else if (typeof cb !== 'function') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'Callback must be a function. Received type ' + (typeof cb) + ' (' + cb + ')')
  }

  if (typeof position !== 'number') pos = -1

  const req = getReq()
  req.callback = cb
  binding.writev(req.handle, fd, buffers, pos)
}

function stat (path, cb) {
  if (typeof path !== 'string') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'Path must be a string. Received type ' + (typeof path) + ' (' + path + ')')
  }

  if (typeof cb !== 'function') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'Callback must be a function. Received type ' + (typeof cb) + ' (' + cb + ')')
  }

  const data = new Array(Stats.length)

  const req = getReq()

  req.callback = function (err, _) {
    if (err) cb(err, null)
    else cb(null, new Stats(...data))
  }

  binding.stat(req.handle, path, data)
}

function statSync (path) {
  if (typeof path !== 'string') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'Path must be a string. Received type ' + (typeof path) + ' (' + path + ')')
  }

  const data = new Array(Stats.length)

  const res = binding.statSync(path, data)
  if (res < 0) throw createError(res)

  return new Stats(...data)
}

function lstat (path, cb) {
  if (typeof path !== 'string') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'Path must be a string. Received type ' + (typeof path) + ' (' + path + ')')
  }

  if (typeof cb !== 'function') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'Callback must be a function. Received type ' + (typeof cb) + ' (' + cb + ')')
  }

  const data = new Array(Stats.length)

  const req = getReq()

  req.callback = function (err, _) {
    if (err) cb(err, null)
    else cb(null, new Stats(...data))
  }

  binding.lstat(req.handle, path, data)
}

function lstatSync (path) {
  if (typeof path !== 'string') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'Path must be a string. Received type ' + (typeof path) + ' (' + path + ')')
  }

  const data = new Array(Stats.length)

  const res = binding.lstatSync(path, data)
  if (res < 0) throw createError(res)

  return new Stats(...data)
}

function fstat (fd, cb) {
  if (typeof fd !== 'number') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'File descriptor must be a number. Received type ' + (typeof fd) + ' (' + fd + ')')
  }

  if (fd < 0 || fd > 0x7fffffff) {
    throw typeError('ERR_OUT_OF_RANGE', 'File descriptor is out of range. It must be >= 0 && <= 2147483647. Received ' + fd)
  }

  if (typeof cb !== 'function') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'Callback must be a function. Received type ' + (typeof cb) + ' (' + cb + ')')
  }

  const data = new Array(Stats.length)

  const req = getReq()

  req.callback = function (err, _) {
    if (err) cb(err, null)
    else cb(null, new Stats(...data))
  }

  binding.fstat(req.handle, fd, data)
}

function fstatSync (fd) {
  if (typeof fd !== 'number') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'File descriptor must be a number. Received type ' + (typeof fd) + ' (' + fd + ')')
  }

  if (fd < 0 || fd > 0x7fffffff) {
    throw typeError('ERR_OUT_OF_RANGE', 'File descriptor is out of range. It must be >= 0 && <= 2147483647. Received ' + fd)
  }

  const data = new Array(Stats.length)

  const res = binding.fstatSync(fd, data)
  if (res < 0) throw createError(res)

  return new Stats(...data)
}

function ftruncate (fd, len, cb) {
  if (typeof fd !== 'number') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'File descriptor must be a number. Received type ' + (typeof fd) + ' (' + fd + ')')
  }

  if (fd < 0 || fd > 0x7fffffff) {
    throw typeError('ERR_OUT_OF_RANGE', 'File descriptor is out of range. It must be >= 0 && <= 2147483647. Received ' + fd)
  }

  if (typeof len === 'function') {
    cb = len
    len = 0
  } else if (typeof cb !== 'function') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'Callback must be a function. Received type ' + (typeof cb) + ' (' + cb + ')')
  }

  const req = getReq()
  req.callback = cb
  binding.ftruncate(req.handle, fd, len)
}

function mkdirp (path, mode, cb) {
  mkdir(path, { mode }, function (err) {
    if (err === null) return cb(null, 0, null)

    if (err.code !== 'ENOENT') {
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

function mkdir (path, opts, cb) {
  if (typeof path !== 'string') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'Path must be a string. Received type ' + (typeof path) + ' (' + path + ')')
  }

  if (typeof opts === 'function') {
    cb = opts
    opts = { mode: 0o777 }
  } else if (typeof cb !== 'function') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'Callback must be a function. Received type ' + (typeof cb) + ' (' + cb + ')')
  }

  if (typeof opts === 'number') opts = { mode: opts }
  else if (!opts) opts = {}

  const mode = typeof opts.mode === 'number' ? opts.mode : 0o777

  if (opts.recursive) return mkdirp(path, mode, cb)

  const req = getReq()
  req.callback = cb
  binding.mkdir(req.handle, path, mode)
}

function rmdir (path, cb) {
  if (typeof path !== 'string') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'Path must be a string. Received type ' + (typeof path) + ' (' + path + ')')
  }

  if (typeof cb !== 'function') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'Callback must be a function. Received type ' + (typeof cb) + ' (' + cb + ')')
  }

  const req = getReq()
  req.callback = cb
  binding.rmdir(req.handle, path)
}

function unlink (path, cb) {
  if (typeof path !== 'string') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'Path must be a string. Received type ' + (typeof path) + ' (' + path + ')')
  }

  if (typeof cb !== 'function') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'Callback must be a function. Received type ' + (typeof cb) + ' (' + cb + ')')
  }

  const req = getReq()
  req.callback = cb
  binding.unlink(req.handle, path)
}

function rename (src, dst, cb) {
  if (typeof src !== 'string') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'Path must be a string. Received type ' + (typeof src) + ' (' + src + ')')
  }

  if (typeof dst !== 'string') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'Path must be a string. Received type ' + (typeof dst) + ' (' + dst + ')')
  }

  if (typeof cb !== 'function') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'Callback must be a function. Received type ' + (typeof cb) + ' (' + cb + ')')
  }

  const req = getReq()
  req.callback = cb
  binding.rename(req.handle, src, dst)
}

function readlink (path, opts, cb) {
  if (typeof path !== 'string') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'Path must be a string. Received type ' + (typeof path) + ' (' + path + ')')
  }

  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  } else if (typeof cb !== 'function') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'Callback must be a function. Received type ' + (typeof cb) + ' (' + cb + ')')
  }

  if (typeof opts === 'string') opts = { encoding: opts }
  else if (!opts) opts = {}

  const {
    encoding = 'utf8'
  } = opts

  const data = Buffer.allocUnsafe(binding.sizeofFSPath)

  const req = getReq()

  req.callback = function (err, _) {
    if (err) return cb(err, null)
    let path = data.subarray(0, data.indexOf(0))
    if (encoding !== 'buffer') path = path.toString(encoding)
    cb(null, path)
  }

  binding.readlink(req.handle, path, data)
}

function opendir (path, opts, cb) {
  if (typeof path !== 'string') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'Path must be a string. Received type ' + (typeof path) + ' (' + path + ')')
  }

  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  } else if (typeof cb !== 'function') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'Callback must be a function. Received type ' + (typeof cb) + ' (' + cb + ')')
  }

  if (typeof opts === 'string') opts = { encoding: opts }
  else if (!opts) opts = {}

  const data = Buffer.allocUnsafe(binding.sizeofFSDir)

  const req = getReq()

  req.callback = function (err, _) {
    if (err) return cb(err, null)
    cb(null, new Dir(path, data, opts))
  }

  binding.opendir(req.handle, path, data)
}

function readdir (path, opts, cb) {
  if (typeof path !== 'string') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'Path must be a string. Received type ' + (typeof path) + ' (' + path + ')')
  }

  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  } else if (typeof cb !== 'function') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'Callback must be a function. Received type ' + (typeof cb) + ' (' + cb + ')')
  }

  if (typeof opts === 'string') opts = { encoding: opts }
  if (!opts) opts = {}

  opendir(path, opts, async (err, dir) => {
    if (err) return cb(err, null)
    const result = []
    dir
      .on('data', (entry) => result.push(entry))
      .on('error', (err) => cb(err, null))
      .on('end', () => cb(null, result))
  })
}

function readFile (path, opts, cb) {
  if (typeof path !== 'string') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'Path must be a string. Received type ' + (typeof path) + ' (' + path + ')')
  }

  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  } else if (typeof cb !== 'function') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'Callback must be a function. Received type ' + (typeof cb) + ' (' + cb + ')')
  }

  if (typeof opts === 'string') opts = { encoding: opts }
  else if (!opts) opts = {}

  const {
    encoding = 'buffer'
  } = opts

  open(path, opts.flag || 'r', function (err, fd) {
    if (err) return cb(err)

    fstat(fd, function (err, st) {
      if (err) return closeAndError(err)

      let buffer = Buffer.allocUnsafe(st.size)
      let len = 0

      read(fd, buffer, loop)

      function loop (err, r) {
        if (err) return closeAndError(err)
        len += r
        if (r === 0 || len === buffer.byteLength) return done()
        read(fd, buffer.subarray(len), loop)
      }

      function done () {
        if (len !== buffer.byteLength) buffer = buffer.subarray(0, len)
        close(fd, function (err) {
          if (err) return cb(err)
          if (encoding !== 'buffer') buffer = buffer.toString(encoding)
          cb(null, buffer)
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
  if (typeof path !== 'string') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'Path must be a string. Received type ' + (typeof path) + ' (' + path + ')')
  }

  if (typeof opts === 'string') opts = { encoding: opts }
  else if (!opts) opts = {}

  const {
    encoding = 'buffer'
  } = opts

  const fd = openSync(path, opts.flag || 'r')

  try {
    const st = fstatSync(fd)

    let buffer = Buffer.allocUnsafe(st.size)
    let len = 0

    while (true) {
      const r = readSync(fd, len ? buffer.subarray(len) : buffer)
      len += r
      if (r === 0 || len === buffer.byteLength) break
    }

    if (len !== buffer.byteLength) buffer = buffer.subarray(0, len)
    if (encoding !== 'buffer') buffer = buffer.toString(encoding)
    return buffer
  } finally {
    try {
      closeSync(fd)
    } catch {}
  }
}

function writeFile (path, data, opts, cb) {
  if (typeof path !== 'string') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'Path must be a string. Received type ' + (typeof path) + ' (' + path + ')')
  }

  if (typeof data !== 'string' && !Buffer.isBuffer(data)) {
    throw typeError('ERR_INVALID_ARG_TYPE', 'Data must be a string or buffer. Received type ' + (typeof data) + ' (' + data + ')')
  }

  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  } else if (typeof cb !== 'function') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'Callback must be a function. Received type ' + (typeof cb) + ' (' + cb + ')')
  }

  if (typeof opts === 'string') opts = { encoding: opts }
  else if (!opts) opts = {}

  if (typeof data === 'string') data = Buffer.from(data, opts.encoding)

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

function writeFileSync (path, data, opts) {
  if (typeof path !== 'string') {
    throw typeError('ERR_INVALID_ARG_TYPE', 'Path must be a string. Received type ' + (typeof path) + ' (' + path + ')')
  }

  if (typeof data !== 'string' && !Buffer.isBuffer(data)) {
    throw typeError('ERR_INVALID_ARG_TYPE', 'Data must be a string or buffer. Received type ' + (typeof data) + ' (' + data + ')')
  }

  if (typeof opts === 'string') opts = { encoding: opts }
  else if (!opts) opts = {}

  if (typeof data === 'string') data = Buffer.from(data, opts.encoding)

  const fd = openSync(path, opts.flag || 'w', opts.mode)

  try {
    let len = 0

    while (true) {
      len += writeSync(fd, len ? data.subarray(len) : data)
      if (len === data.byteLength) break
    }
  } finally {
    try {
      closeSync(fd)
    } catch {}
  }
}

class Stats {
  constructor (dev, mode, nlink, uid, gid, rdev, blksize, ino, size, blocks, atimeMs, mtimeMs, ctimeMs, birthtimeMs) {
    this.dev = dev
    this.mode = mode
    this.nlink = nlink
    this.uid = uid
    this.gid = gid
    this.rdev = rdev
    this.blksize = blksize
    this.ino = ino
    this.size = size
    this.blocks = blocks
    this.atimeMs = atimeMs
    this.mtimeMs = mtimeMs
    this.ctimeMs = ctimeMs
    this.birthtimeMs = birthtimeMs
    this.atime = new Date(atimeMs)
    this.mtime = new Date(mtimeMs)
    this.ctime = new Date(ctimeMs)
    this.birthtime = new Date(birthtimeMs)
  }

  isDirectory () {
    return (this.mode & constants.S_IFMT) === constants.S_IFDIR
  }

  isFile () {
    return (this.mode & constants.S_IFMT) === constants.S_IFREG
  }

  isBlockDevice () {
    return (this.mode & constants.S_IFMT) === constants.S_IFBLK
  }

  isCharacterDevice () {
    return (this.mode & constants.S_IFCHR) === constants.S_IFCHR
  }

  isFIFO () {
    return (this.mode & constants.S_IFMT) === constants.S_IFIFO
  }

  isSymbolicLink () {
    return (this.mode & constants.S_IFMT) === constants.S_IFLNK
  }

  isSocket () {
    return (this.mode & constants.S_IFMT) === constants.S_IFSOCK
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

    const data = Buffer.allocUnsafe(Math.min(this._missing, 65536))

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

class Dir extends Readable {
  constructor (path, handle, opts = {}) {
    const {
      encoding = 'utf8',
      bufferSize = 32
    } = opts

    super()

    this._handle = handle
    this._dirents = Buffer.allocUnsafe(binding.sizeofFSDirent * bufferSize)
    this._encoding = encoding
    this._closed = false

    this.path = path
  }

  _read (cb) {
    const self = this
    const data = []

    const req = getReq()

    req.callback = function (err, _) {
      if (err) return cb(err)
      if (data.length === 0) self.push(null)
      else {
        for (const entry of data) {
          let name = Buffer.from(entry.name)
          if (self._encoding !== 'buffer') name = name.toString(self._encoding)
          self.push(new Dirent(self.path, name, entry.type))
        }
      }
      cb(null)
    }

    binding.readdir(req.handle, this._handle, this._dirents, data)
  }

  _destroy (cb) {
    if (this._closed) cb(null)
    else this.close(cb)
  }

  close (cb = noop) {
    if (this._closed) return

    const self = this

    const req = getReq()

    req.callback = function (err, _) {
      if (err) return cb(err)
      self._closed = true
      cb(null)
    }

    binding.closedir(req.handle, this._handle)
  }
}

class Dirent {
  constructor (path, name, type) {
    this._type = type

    this.path = path
    this.name = name
  }

  isFile () {
    return this._type === constants.UV_DIRENT_FILE
  }

  isDirectory () {
    return this._type === constants.UV_DIRENT_DIR
  }

  isSymbolicLink () {
    return this._type === constants.UV_DIRENT_LINK
  }

  isFIFO () {
    return this._type === constants.UV_DIRENT_FIFO
  }

  isSocket () {
    return this._type === constants.UV_DIRENT_SOCKET
  }

  isCharacterDevice () {
    return this._type === constants.UV_DIRENT_CHAR
  }

  isBlockDevice () {
    return this._type === constants.UV_DIRENT_BLOCK
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
exports.fstat = fstat
exports.ftruncate = ftruncate

exports.openSync = openSync
exports.closeSync = closeSync
exports.readSync = readSync
exports.writeSync = writeSync
exports.statSync = statSync
exports.lstatSync = lstatSync
exports.fstatSync = fstatSync

exports.stat = stat
exports.promises.stat = promisify(stat)

exports.lstat = lstat
exports.promises.lstat = promisify(lstat)

exports.mkdir = mkdir
exports.promises.mkdir = promisify(mkdir)

exports.rmdir = rmdir
exports.promises.rmdir = promisify(rmdir)

exports.unlink = unlink
exports.promises.unlink = promisify(unlink)

exports.rename = rename
exports.promises.rename = promisify(rename)

exports.readlink = readlink
exports.promises.readlink = promisify(readlink)

exports.opendir = opendir
exports.promises.opendir = promisify(opendir)

exports.readdir = readdir
exports.promises.readdir = promisify(readdir)

exports.readFile = readFile
exports.promises.readFile = promisify(readFile)

exports.writeFile = writeFile
exports.promises.writeFile = promisify(writeFile)

exports.readFileSync = readFileSync
exports.writeFileSync = writeFileSync

exports.Stats = Stats

exports.ReadStream = FileReadStream
exports.createReadStream = function createReadStream (path, opts) {
  return new FileReadStream(path, opts)
}

exports.WriteStream = FileWriteStream
exports.createWriteStream = function createWriteStream (path, opts) {
  return new FileWriteStream(path, opts)
}

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

function map (data) {
  return typeof data === 'string' ? Buffer.from(data) : data
}
