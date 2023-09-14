# bare-fs

Native file system for Javascript.

```
npm i bare-fs
```

## Usage

``` js
const fs = require('bare-fs')

// Currently supports:

fs.open
fs.close
fs.read
fs.readv
fs.write
fs.writev
fs.stat
fs.lstat
fs.fstat
fs.ftruncate
fs.mkdir
fs.rmdir
fs.unlink
fs.rename
fs.readlink
fs.opendir
fs.readdir
fs.chmod

fs.readFile
fs.writeFile

fs.promises.stat
fs.promises.lstat
fs.promises.mkdir
fs.promises.rmdir
fs.promises.unlink
fs.promises.rename
fs.promises.readlink
fs.promises.opendir
fs.promises.readdir
fs.promises.readFile
fs.promises.writeFile
fs.promises.chmod

fs.createReadStream
fs.createWriteStream

fs.openSync
fs.closeSync
fs.readSync
fs.writeSync
fs.statSync
fs.lstatSync
fs.fstatSync
fs.readFileSync
fs.writeFileSync
fs.chmodSync
```

## License

Apache-2.0
