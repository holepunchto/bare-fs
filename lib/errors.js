module.exports = class FileError extends Error {
  constructor(msg, opts = {}) {
    const { code, path = null, destination = null, fd = -1 } = opts

    super(`${code}: ${msg}`)

    this.code = code

    if (path !== null) this.path = path
    if (destination !== null) this.destination = destination
    if (fd !== -1) this.fd = fd
  }

  get name() {
    return 'FileError'
  }
}
