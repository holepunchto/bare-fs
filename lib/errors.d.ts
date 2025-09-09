declare class FileError extends Error {
  private constructor(msg: string)

  readonly code: string
}

export = FileError
