declare class FileError extends Error {
  private constructor(msg: string)

  readonly code: string
  readonly path?: string
  readonly destination?: string
  readonly fd?: number
}

export = FileError
