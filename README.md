# bare-fs

Native file system for Javascript.

```
npm i bare-fs
```

## Usage

```js
const fs = require('bare-fs')

// Currently supports:

fs.chmod
fs.close
fs.fstat
fs.ftruncate
fs.lstat
fs.mkdir
fs.open
fs.opendir
fs.read
fs.readdir
fs.readlink
fs.readv
fs.rename
fs.rmdir
fs.stat
fs.symlink
fs.unlink
fs.write
fs.writev

fs.readFile
fs.writeFile

fs.promises.chmod
fs.promises.lstat
fs.promises.mkdir
fs.promises.opendir
fs.promises.readFile
fs.promises.readdir
fs.promises.readlink
fs.promises.rename
fs.promises.rmdir
fs.promises.stat
fs.promises.symlink
fs.promises.unlink
fs.promises.writeFile

fs.createReadStream
fs.createWriteStream

fs.chmodSync
fs.closeSync
fs.fstatSync
fs.lstatSync
fs.openSync
fs.readSync
fs.statSync
fs.symlinkSync
fs.writeSync

fs.readFileSync
fs.writeFileSync
```

## License

Apache-2.0
