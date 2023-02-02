# @pearjs/fs

Native fs for Javascript

```
npm install @pearjs/fs
```

Useful for embedded devices that only have n-api but not node.


## Usage

``` js
const fs = require('@pearjs/fs')

// currently supports

fs.open
fs.close
fs.unlink
fs.read
fs.readv
fs.write
fs.writev
fs.ftruncate
fs.stat
fs.fstat
fs.lstat
fs.mkdir
fs.rmdir
fs.rename

fs.readFile
fs.writeFile

fs.promises.readFile
fs.promises.writeFile
fs.promises.mkdir
fs.promises.rmdir
fs.promises.stat
fs.promises.unlink

fs.createReadStream
fs.createWriteStream

fs.writeFileSync
fs.readFileSync
fs.openSync
fs.readSync
fs.writeSync
fs.statSync
fs.lstatSync
fs.fstatSync
fs.closeSync
```

## License

MIT
