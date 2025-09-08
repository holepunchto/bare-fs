module.exports = class FileError extends Error {
  constructor(msg, opts = {}) {
    const { code, path = null } = opts

    super(`${code}: ${msg}`)

    this.code = code
    this.path = path
  }

  get name() {
    return 'FileError'
  }
}
