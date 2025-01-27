import EventEmitter, { EventMap } from 'bare-events'
import Buffer, { BufferEncoding } from 'bare-buffer'
import { Readable, Writable } from 'bare-stream'

export const constants: {
  O_RDWR: number
  O_RDONLY: number
  O_WRONLY: number
  O_CREAT: number
  O_TRUNC: number
  O_APPEND: number

  F_OK: number
  R_OK: number
  W_OK: number
  X_OK: number

  S_IFMT: number
  S_IFREG: number
  S_IFDIR: number
  S_IFCHR: number
  S_IFLNK: number
  S_IFBLK: number
  S_IFIFO: number
  S_IFSOCK: number

  S_IRUSR: number
  S_IWUSR: number
  S_IXUSR: number
  S_IRGRP: number
  S_IWGRP: number
  S_IXGRP: number
  S_IROTH: number
  S_IWOTH: number
  S_IXOTH: number

  UV_DIRENT_UNKNOWN: number
  UV_DIRENT_FILE: number
  UV_DIRENT_DIR: number
  UV_DIRENT_LINK: number
  UV_DIRENT_FIFO: number
  UV_DIRENT_SOCKET: number
  UV_DIRENT_CHAR: number
  UV_DIRENT_BLOCK: number

  COPYFILE_EXCL: number
  COPYFILE_FICLONE: number
  COPYFILE_FICLONE_FORCE: number
  UV_FS_SYMLINK_DIR: number
  UV_FS_SYMLINK_JUNCTION: number
}

type FsFlag =
  | 'a'
  | 'a+'
  | 'as'
  | 'as+'
  | 'ax'
  | 'ax+'
  | 'r'
  | 'r+'
  | 'rs'
  | 'rs+'
  | 'sa'
  | 'sa+'
  | 'sr'
  | 'sr+'
  | 'w'
  | 'w+'
  | 'wx'
  | 'wx+'
  | 'xa'
  | 'xa+'
  | 'xw'
  | 'xw+'

interface FsCallback {
  (err: Error | null): void
}

interface FsCallbackResponse {
  (err: Error | null, len: number): void
}

interface Dir extends Iterable<Dirent>, AsyncIterable<Dirent> {
  readonly path: string

  read(cb: (dirent: Dirent | null) => void): void
  readSync(): Dirent | null

  close(cb: FsCallback): void
  closeSync(): void
}

export class Dir {
  constructor(path: string, handle: Buffer, opts?: DirOptions)
}

export class Dirent {
  constructor(path: string, type: number, name: string)

  readonly path: string
  readonly type: number
  readonly name: string

  isFile(): boolean
  isDirectory(): boolean
  isSymbolicLink(): boolean
  isFIFO(): boolean
  isSocket(): boolean
  isCharacterDevice(): boolean
  isBlockDevice(): boolean
}

export class Stats {
  constructor(
    dev: number,
    mode: number,
    nlink: number,
    uid: number,
    gid: number,
    rdev: number,
    blksize: number,
    ino: number,
    size: number,
    blocks: number,
    atimeMs: number,
    mtimeMs: number,
    ctimeMs: number,
    birthtimeMs: number
  )

  readonly dev: number
  readonly mode: number
  readonly nlink: number
  readonly uid: number
  readonly gid: number
  readonly rdev: number
  readonly blksize: number
  readonly ino: number
  readonly size: number
  readonly blocks: number
  readonly atimeMs: Date
  readonly mtimeMs: Date
  readonly ctimeMs: Date
  readonly birthtimeMs: Date

  isDirectory(): boolean
  isFile(): boolean
  isBlockDevice(): boolean
  isCharacterDevice(): boolean
  isFIFO(): boolean
  isSymbolicLink(): boolean
  isSocket(): boolean
}

interface FileReadStreamOptions {
  flags?: FsFlag
  mode?: number
}

export class FileReadStream extends Readable {
  constructor(path: string, opts?: FileWriteStreamOptions)

  readonly path: string
  readonly fd: number
}

export function createReadStream(
  path: string,
  opts?: FileReadStreamOptions
): FileReadStream

interface FileWriteStreamOptions {
  flags?: FsFlag
  mode?: number
}

export class FileWriteStream extends Writable {
  constructor(path: string, opts?: FileWriteStreamOptions)

  readonly path: string
  readonly fd: number
  readonly flags: FsFlag
  readonly mode: number
}

export function createWriteStream(
  path: string,
  opts?: FileWriteStreamOptions
): FileWriteStream

interface WatcherOptions {
  persistent?: boolean
  recursive?: boolean
  encoding?: BufferEncoding
}

interface WatcherEvents extends EventMap {
  error: [err: Error]
  change: [type: 'rename' | 'change', filename: string | Buffer]
  close: []
}

interface Watcher
  extends EventEmitter<WatcherEvents>,
    AsyncIterable<{
      eventType: 'rename' | 'change'
      filename: string | Buffer
    }> {
  close(): void

  ref(): void
  unref(): void
}

export class Watcher {
  constructor(path: string | Buffer, opts: WatcherOptions)
}

export function access(filepath: string, mode: number, cb: FsCallback): void
export function access(filepath: string, cb: FsCallback): void
export function accessSync(filepath: string, mode?: number): void

interface AppendFileOptions {
  encoding?: BufferEncoding
  flag?: string
  mode?: number
}

export function appendFile(
  filepath: string,
  data: string | Buffer | ArrayBufferView,
  opts: AppendFileOptions,
  cb: FsCallback
): void

export function appendFile(
  filepath: string,
  data: string | Buffer | ArrayBufferView,
  encoding: BufferEncoding,
  cb: FsCallback
): void

export function appendFile(
  filepath: string,
  data: string | Buffer | ArrayBufferView,
  cb: FsCallback
): void

export function appendFileSync(
  filepath: string,
  data: string | Buffer | ArrayBufferView,
  encoding: BufferEncoding
): void

export function appendFileSync(
  filepath: string,
  data: string | Buffer | ArrayBufferView,
  opts?: AppendFileOptions
): void

export function chmod(
  filepath: string,
  mode: string | number,
  cb: FsCallback
): void

export function chmodSync(filepath: string, mode: string | number): void

export function close(fd: number, cb?: FsCallback): void
export function closeSync(fd: number): void

export function copyFile(
  src: string,
  dst: string,
  mode: number,
  cb: FsCallback
): void

export function copyFile(src: string, dst: string, cb: FsCallback): void
export function copyFileSync(src: string, dst: string, mode?: number): void

export function exists(filepath: string, cb: (exists: boolean) => void): void
export function existsSync(filepath: string): boolean

export function fchmod(fd: number, mode: string | number, cb: FsCallback): void
export function fchmodSync(fd: number, mode: string | number): void

export function fstat(
  fd: number,
  cb: (err: Error | null, stats: Stats | null) => void
): void

export function fstatSync(fd: number): Stats

export function ftruncate(fd: number, len: number, cb: FsCallback): void
export function ftruncate(fd: number, cb: FsCallback): void

export function lstat(
  filepath: string,
  cb: (err: Error | null, stats: Stats | null) => void
): void

export function lstatSync(filepath: string): Stats

interface MkdirOptions {
  mode?: number
  recursive?: boolean
}

export function mkdir(
  filepath: string,
  opts: MkdirOptions,
  cb: FsCallback
): void

export function mkdir(filepath: string, mode: number, cb: FsCallback): void
export function mkdir(filepath: string, cb: FsCallback): void
export function mkdirSync(filepath: string, mode: number): void
export function mkdirSync(filepath: string, opts: MkdirOptions): void

export function open(
  filepath: string,
  flags: FsFlag | number,
  mode: string | number,
  cb: FsCallbackResponse
): void

export function open(
  filepath: string,
  flags: FsFlag | number,
  cb: FsCallbackResponse
): void

export function open(filepath: string, cb: FsCallbackResponse): void

export function openSync(
  filepath: string,
  flags?: FsFlag | number,
  mode?: string | number
): number

interface DirOptions {
  encoding?: BufferEncoding
  bufferSize?: number
}

export function opendir(
  filepath: string,
  opts: DirOptions,
  cb: (err: Error | null, dir: Dir | null) => void
): void

export function opendir(
  filepath: string,
  encoding: BufferEncoding,
  cb: (err: Error | null, dir: Dir | null) => void
): void

export function opendir(
  filepath: string,
  cb: (err: Error | null, dir: Dir | null) => void
): void

export function opendirSync(filepath: string, encoding: BufferEncoding): Dir
export function opendirSync(filepath: string, opts?: DirOptions): Dir

export function read(
  fd: number,
  buffer: Buffer | ArrayBufferView,
  offset: number,
  len: number,
  pos: number,
  cb: FsCallbackResponse
): void

export function read(
  fd: number,
  buffer: Buffer | ArrayBufferView,
  offset: number,
  len: number,
  cb: FsCallbackResponse
): void

export function read(
  fd: number,
  buffer: Buffer | ArrayBufferView,
  offset: number,
  cb: FsCallbackResponse
): void

export function read(
  fd: number,
  buffer: Buffer | ArrayBufferView,
  cb: FsCallbackResponse
): void

export function readSync(
  fd: number,
  buffer: Buffer | ArrayBufferView,
  offset?: number,
  len?: number,
  pos?: number
): number

interface ReadFileOptions {
  encoding?: BufferEncoding
  flag?: FsFlag
}

interface ReaddirOptions extends DirOptions {
  withFileTypes?: boolean
}

export function readdir(
  filepath: string,
  opts: ReaddirOptions,
  cb: (err: Error | null, entries: Dir[] | string[] | null) => void
): void

export function readdir(
  filepath: string,
  encoding: BufferEncoding,
  cb: (err: Error | null, entries: Dir[] | string[] | null) => void
): void

export function readdir(
  filepath: string,
  cb: (err: Error | null, entries: Dir[] | string[] | null) => void
): void

export function readdirSync(
  filepath: string,
  opts?: ReaddirOptions
): Dir[] | string[]

export function readdirSync(
  filepath: string,
  encoding: BufferEncoding
): Dir[] | string[]

export function readFile(
  filepath: string,
  opts: ReadFileOptions,
  cb: (err: Error | null, buffer?: string | Buffer) => void
): void

export function readFile(
  filepath: string,
  encoding: BufferEncoding,
  cb: (err: Error | null, buffer?: string | Buffer) => void
): void

export function readFile(
  filepath: string,
  cb: (err: Error | null, buffer?: string | Buffer) => void
): void

export function readFileSync(
  filepath: string,
  opts?: ReadFileOptions
): string | Buffer

export function readFileSync(
  filepath: string,
  encoding: BufferEncoding
): string | Buffer

interface ReadlineOptions {
  encoding?: BufferEncoding
}

export function readline(
  filepath: string,
  opts: ReadlineOptions,
  cb: (err: Error | null, path: string | Buffer | null) => void
): void

export function readline(
  filepath: string,
  cb: (err: Error | null, path: string | Buffer | null) => void
): void

interface ReadlinkOptions {
  encoding?: BufferEncoding
}

export function readlink(
  filepath: string,
  opts: ReadlinkOptions,
  cb: (err: Error | null, link: string | Buffer | null) => void
): void

export function readlink(
  filepath: string,
  encoding: BufferEncoding,
  cb: (err: Error | null, link: string | Buffer | null) => void
): void

export function readlink(
  filepath: string,
  cb: (err: Error | null, link: string | Buffer | null) => void
): void

export function readlinkSync(
  filepath: string,
  opts?: ReadlinkOptions
): string | Buffer

export function readlinkSync(
  filepath: string,
  encoding: BufferEncoding
): string | Buffer

export function readv(
  fd: number,
  buffers: ArrayBufferView[],
  position: number | null,
  cb: FsCallbackResponse
): void

export function readv(
  fd: number,
  buffers: ArrayBufferView[],
  cb: FsCallbackResponse
): void

interface RealpathOptions {
  encoding?: BufferEncoding
}

export function realpath(
  filepath: string,
  opts: RealpathOptions,
  cb: (err: Error | null, path: string | Buffer | null) => void
): void

export function realpath(
  filepath: string,
  cb: (err: Error | null, path: string | Buffer | null) => void
): void

export function realpathSync(
  filepath: string,
  encoding: BufferEncoding
): string | Buffer

export function realpathSync(
  filepath: string,
  opts?: RealpathOptions
): string | Buffer

export function rename(src: string, dst: string, cb: FsCallback): void
export function renameSync(src: string, dst: string): void

interface RmOptions {
  force?: boolean
  recursive?: boolean
}

export function rm(filepath: string, opts: RmOptions, cb: FsCallback): void
export function rm(filepath: string, cb: FsCallback): void
export function rmSync(filepath: string, opts?: RmOptions): void

export function rmdir(filepath: string, cb: FsCallback): void
export function rmdirSync(filepath: string): void

export function stat(
  filepath: string,
  cb: (err: Error | null, stats: Stats | null) => void
): void

export function statSync(filepath: string): Stats

export function symlink(
  target: string,
  filepath: string,
  type: string | number,
  cb: FsCallback
): void

export function symlink(target: string, filepath: string, cb: FsCallback): void

export function symlinkSync(
  target: string,
  filepath: string,
  type?: string | number
): void

export function unlink(filepath: string, cb: FsCallback): void
export function unlinkSync(filepath: string): void

export function watch(
  filepath: string,
  opts: WatcherOptions,
  cb: (type: 'rename' | 'change', filename: string | Buffer) => void
): Watcher

export function watch(
  filepath: string,
  encoding: BufferEncoding,
  cb: (type: 'rename' | 'change', filename: string | Buffer) => void
): Watcher

export function watch(
  filepath: string,
  cb: (type: 'rename' | 'change', filename: string | Buffer) => void
): Watcher

export function write(
  fd: number,
  data: Buffer | ArrayBufferView,
  offset: number,
  len: number,
  pos: number,
  cb: FsCallbackResponse
): void

export function write(
  fd: number,
  data: Buffer | ArrayBufferView,
  offset: number,
  len: number,
  cb: FsCallbackResponse
): void

export function write(
  fd: number,
  data: string,
  pos: string | number,
  encoding: BufferEncoding,
  cb: FsCallbackResponse
): void

export function write(
  fd: number,
  data: Buffer | ArrayBufferView,
  offset: number,
  cb: FsCallbackResponse
): void

export function write(
  fd: number,
  data: string,
  pos: string | number,
  cb: FsCallbackResponse
): void

export function write(
  fd: number,
  data: Buffer | ArrayBufferView,
  cb: FsCallbackResponse
): void

export function write(fd: number, data: string, cb: FsCallbackResponse): void

export function writeSync(
  fd: number,
  data: string | Buffer | ArrayBufferView,
  offset?: number,
  len?: number,
  pos?: number
): void

interface WriteFileOptions {
  encoding?: BufferEncoding
  flag?: FsFlag
  mode?: number
}

export function writeFile(
  filepath: string,
  data: string | Buffer | ArrayBufferView,
  opts: WriteFileOptions,
  cb: FsCallback
): void

export function writeFile(
  filepath: string,
  data: string | Buffer | ArrayBufferView,
  encoding: BufferEncoding,
  cb: FsCallback
): void

export function writeFile(
  filepath: string,
  data: string | Buffer | ArrayBufferView,
  cb: FsCallback
): void

export function writeFileSync(
  filepath: string,
  data: string | Buffer | ArrayBufferView,
  encoding: BufferEncoding
): void

export function writeFileSync(
  filepath: string,
  data: string | Buffer | ArrayBufferView,
  opts?: WriteFileOptions
): void

export function writev(
  fd: number,
  buffers: ArrayBufferView[],
  pos: number | null,
  cb: FsCallbackResponse
): void

export function writev(
  fd: number,
  buffers: ArrayBufferView[],
  cb: FsCallbackResponse
): void

export namespace promises {
  type Promisify<F> = F extends (...args: infer Args) => infer R
    ? (...args: Args) => Promise<R>
    : void

  export const access: Promisify<typeof accessSync>
  export const appendFile: Promisify<typeof appendFileSync>
  export const chmod: Promisify<typeof chmodSync>
  export const copyFile: Promisify<typeof copyFileSync>
  export const lstat: Promisify<typeof lstatSync>
  export const mkdir: Promisify<typeof mkdirSync>
  export const opendir: Promisify<typeof opendirSync>
  export const readFile: Promisify<typeof readFileSync>
  export const readdir: Promisify<typeof readdirSync>
  export const readlink: Promisify<typeof readlinkSync>
  export const realpath: Promisify<typeof realpathSync>
  export const rename: Promisify<typeof renameSync>
  export const rm: Promisify<typeof rmSync>
  export const rmdir: Promisify<typeof rmdirSync>
  export const stat: Promisify<typeof statSync>
  export const symlink: Promisify<typeof symlinkSync>
  export const unlink: Promisify<typeof unlinkSync>
  export const writeFile: Promisify<typeof writeFileSync>

  export function watch(filepath: string, opts: WatcherOptions): Watcher
  export function watch(filepath: string, encoding: BufferEncoding): Watcher
}
