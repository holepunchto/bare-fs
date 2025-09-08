declare class FileError extends Error {
  constructor(msg: string, fn: Error)

  readonly code: string

  static ENOENT(msg: string, path: string): FileError
}

export = FileError
