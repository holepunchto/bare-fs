#include <bare.h>
#include <js.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <uv.h>

typedef struct {
  js_ref_t *ctx;
  js_ref_t *on_open;
} bare_fs_t;

typedef struct {
  uv_fs_t req;
  bare_fs_t *fs;
  js_env_t *env;
  uv_buf_t buf;
  uint32_t id;
} bare_fs_req_t;

typedef uv_dir_t *bare_fs_dir_t;

typedef uv_dirent_t bare_fs_dirent_t;

static inline uint64_t
time_to_ms (uv_timespec_t time) {
  return time.tv_sec * 1e3 + time.tv_nsec / 1e6;
}

static inline void
copy_stat (uv_fs_t *req, uv_buf_t *buf) {
  if (req->result != 0) return;

  uv_stat_t *stat = &req->statbuf;

  uint64_t *s = (uint64_t *) buf->base;

  *(s++) = stat->st_dev;
  *(s++) = stat->st_mode;
  *(s++) = stat->st_nlink;
  *(s++) = stat->st_uid;

  *(s++) = stat->st_gid;
  *(s++) = stat->st_rdev;
  *(s++) = stat->st_ino;
  *(s++) = stat->st_size;

  *(s++) = stat->st_blksize;
  *(s++) = stat->st_blocks;
  *(s++) = stat->st_flags;
  *(s++) = stat->st_gen;

  *(s++) = time_to_ms(stat->st_atim);
  *(s++) = time_to_ms(stat->st_mtim);
  *(s++) = time_to_ms(stat->st_ctim);
  *(s++) = time_to_ms(stat->st_birthtim);
}

static inline void
copy_ptr (uv_fs_t *req, uv_buf_t *buf) {
  if (req->result != 0) return;

  memcpy(buf->base, req->ptr, buf->len);
}

static inline void
copy_ptr_address (uv_fs_t *req, uv_buf_t *buf) {
  if (req->result != 0) return;

  memcpy(buf->base, &req->ptr, buf->len);
}

static void
on_fs_response (uv_fs_t *req) {
  bare_fs_req_t *p = (bare_fs_req_t *) req;

  js_handle_scope_t *scope;
  js_open_handle_scope(p->env, &scope);

  js_value_t *cb;
  js_get_reference_value(p->env, p->fs->on_open, &cb);

  js_value_t *ctx;
  js_get_reference_value(p->env, p->fs->ctx, &ctx);

  js_value_t *argv[2];
  js_create_uint32(p->env, p->id, &argv[0]);
  js_create_int32(p->env, req->result, &argv[1]);

  uv_fs_req_cleanup(req);

  js_call_function(p->env, ctx, cb, 2, argv, NULL);

  js_close_handle_scope(p->env, scope);
}

static void
on_fs_stat_response (uv_fs_t *req) {
  bare_fs_req_t *p = (bare_fs_req_t *) req;

  copy_stat(req, &p->buf);

  on_fs_response(req);
}

static void
on_fs_readlink_response (uv_fs_t *req) {
  bare_fs_req_t *p = (bare_fs_req_t *) req;

  copy_ptr(req, &p->buf);

  on_fs_response(req);
}

static void
on_fs_opendir_response (uv_fs_t *req) {
  bare_fs_req_t *p = (bare_fs_req_t *) req;

  copy_ptr_address(req, &p->buf);

  on_fs_response(req);
}

static void
on_fs_readdir_response (uv_fs_t *req) {
  bare_fs_req_t *p = (bare_fs_req_t *) req;

  on_fs_response(req);
}

static js_value_t *
bare_fs_init (js_env_t *env, js_callback_info_t *info) {
  size_t argc = 3;
  js_value_t *argv[3];

  js_get_callback_info(env, info, &argc, argv, NULL, NULL);

  bare_fs_t *fs;
  js_get_typedarray_info(env, argv[0], NULL, (void **) &fs, NULL, NULL, NULL);

  js_create_reference(env, argv[1], 1, &fs->ctx);
  js_create_reference(env, argv[2], 1, &fs->on_open);

  return NULL;
}

static js_value_t *
bare_fs_destroy (js_env_t *env, js_callback_info_t *info) {
  size_t argc = 1;
  js_value_t *argv[1];

  js_get_callback_info(env, info, &argc, argv, NULL, NULL);

  bare_fs_t *fs;
  js_get_typedarray_info(env, argv[0], NULL, (void **) &fs, NULL, NULL, NULL);

  js_delete_reference(env, fs->on_open);
  js_delete_reference(env, fs->ctx);

  return NULL;
}

static js_value_t *
bare_fs_req_init (js_env_t *env, js_callback_info_t *info) {
  size_t argc = 2;
  js_value_t *argv[2];

  js_get_callback_info(env, info, &argc, argv, NULL, NULL);

  bare_fs_t *fs;
  js_get_typedarray_info(env, argv[0], NULL, (void **) &fs, NULL, NULL, NULL);

  bare_fs_req_t *req;
  js_get_typedarray_info(env, argv[1], NULL, (void **) &req, NULL, NULL, NULL);

  req->fs = fs;

  return NULL;
}

static js_value_t *
bare_fs_open (js_env_t *env, js_callback_info_t *info) {
  size_t argc = 4;
  js_value_t *argv[4];

  js_get_callback_info(env, info, &argc, argv, NULL, NULL);

  bare_fs_req_t *req;
  js_get_typedarray_info(env, argv[0], NULL, (void **) &req, NULL, NULL, NULL);

  char path[4097];
  js_get_value_string_utf8(env, argv[1], path, 4096, NULL);

  int32_t flags;
  js_get_value_int32(env, argv[2], &flags);

  int32_t mode;
  js_get_value_int32(env, argv[3], &mode);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  req->env = env;

  uv_fs_open(loop, (uv_fs_t *) req, path, flags, mode, on_fs_response);

  return NULL;
}

static js_value_t *
bare_fs_open_sync (js_env_t *env, js_callback_info_t *info) {
  size_t argc = 3;
  js_value_t *argv[3];

  js_get_callback_info(env, info, &argc, argv, NULL, NULL);

  char path[4097];
  js_get_value_string_utf8(env, argv[0], path, 4096, NULL);

  int32_t flags;
  js_get_value_int32(env, argv[1], &flags);

  int32_t mode;
  js_get_value_int32(env, argv[2], &mode);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  uv_fs_t req;
  uv_fs_open(loop, &req, path, flags, mode, NULL);

  js_value_t *res;
  js_create_int32(env, req.result, &res);

  uv_fs_req_cleanup(&req);

  return res;
}

static js_value_t *
bare_fs_write (js_env_t *env, js_callback_info_t *info) {
  size_t argc = 6;
  js_value_t *argv[6];

  js_get_callback_info(env, info, &argc, argv, NULL, NULL);

  bare_fs_req_t *req;
  js_get_typedarray_info(env, argv[0], NULL, (void **) &req, NULL, NULL, NULL);

  uint32_t fd;
  js_get_value_uint32(env, argv[1], &fd);

  void *data;
  js_get_typedarray_info(env, argv[2], NULL, &data, NULL, NULL, NULL);

  uint32_t offset;
  js_get_value_uint32(env, argv[3], &offset);

  uint32_t len;
  js_get_value_uint32(env, argv[4], &len);

  int64_t pos;
  js_get_value_int64(env, argv[5], &pos);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  req->env = env;

  const uv_buf_t buf = uv_buf_init(data + offset, len);

  uv_fs_write(loop, (uv_fs_t *) req, fd, &buf, 1, pos, on_fs_response);

  return NULL;
}

static js_value_t *
bare_fs_write_sync (js_env_t *env, js_callback_info_t *info) {
  size_t argc = 5;
  js_value_t *argv[5];

  js_get_callback_info(env, info, &argc, argv, NULL, NULL);

  uint32_t fd;
  js_get_value_uint32(env, argv[0], &fd);

  void *data;
  js_get_typedarray_info(env, argv[1], NULL, &data, NULL, NULL, NULL);

  uint32_t offset;
  js_get_value_uint32(env, argv[2], &offset);

  uint32_t len;
  js_get_value_uint32(env, argv[3], &len);

  int64_t pos;
  js_get_value_int64(env, argv[4], &pos);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  const uv_buf_t buf = uv_buf_init(data + offset, len);

  uv_fs_t req;
  uv_fs_write(loop, &req, fd, &buf, 1, pos, NULL);

  js_value_t *res;
  js_create_int32(env, req.result, &res);

  uv_fs_req_cleanup(&req);

  return res;
}

static js_value_t *
bare_fs_writev (js_env_t *env, js_callback_info_t *info) {
  size_t argc = 4;
  js_value_t *argv[4];

  js_get_callback_info(env, info, &argc, argv, NULL, NULL);

  bare_fs_req_t *req;
  js_get_typedarray_info(env, argv[0], NULL, (void **) &req, NULL, NULL, NULL);

  uint32_t fd;
  js_get_value_uint32(env, argv[1], &fd);

  js_value_t *arr = argv[2];
  js_value_t *item;

  int64_t pos;
  js_get_value_int64(env, argv[3], &pos);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  req->env = env;

  uint32_t bufs_len;
  js_get_array_length(env, arr, &bufs_len);

  uv_buf_t *bufs = malloc(sizeof(uv_buf_t) * bufs_len);

  for (uint32_t i = 0; i < bufs_len; i++) {
    js_get_element(env, arr, i, &item);

    uv_buf_t *buf = &bufs[i];
    js_get_typedarray_info(env, item, NULL, (void **) &buf->base, &buf->len, NULL, NULL);
  }

  uv_fs_write(loop, (uv_fs_t *) req, fd, bufs, bufs_len, pos, on_fs_response);

  free(bufs);

  return NULL;
}

static js_value_t *
bare_fs_read (js_env_t *env, js_callback_info_t *info) {
  size_t argc = 6;
  js_value_t *argv[6];

  js_get_callback_info(env, info, &argc, argv, NULL, NULL);

  bare_fs_req_t *req;
  js_get_typedarray_info(env, argv[0], NULL, (void **) &req, NULL, NULL, NULL);

  uint32_t fd;
  js_get_value_uint32(env, argv[1], &fd);

  void *data;
  js_get_typedarray_info(env, argv[2], NULL, &data, NULL, NULL, NULL);

  uint32_t offset;
  js_get_value_uint32(env, argv[3], &offset);

  uint32_t len;
  js_get_value_uint32(env, argv[4], &len);

  int64_t pos;
  js_get_value_int64(env, argv[5], &pos);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  req->env = env;

  const uv_buf_t buf = uv_buf_init(data + offset, len);

  uv_fs_read(loop, (uv_fs_t *) req, fd, &buf, 1, pos, on_fs_response);

  return NULL;
}

static js_value_t *
bare_fs_read_sync (js_env_t *env, js_callback_info_t *info) {
  size_t argc = 5;
  js_value_t *argv[5];

  js_get_callback_info(env, info, &argc, argv, NULL, NULL);

  uint32_t fd;
  js_get_value_uint32(env, argv[0], &fd);

  void *data;
  js_get_typedarray_info(env, argv[1], NULL, &data, NULL, NULL, NULL);

  uint32_t offset;
  js_get_value_uint32(env, argv[2], &offset);

  uint32_t len;
  js_get_value_uint32(env, argv[3], &len);

  int64_t pos;
  js_get_value_int64(env, argv[4], &pos);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  const uv_buf_t buf = uv_buf_init(data + offset, len);

  uv_fs_t req;
  uv_fs_read(loop, (uv_fs_t *) &req, fd, &buf, 1, pos, NULL);

  js_value_t *res;
  js_create_int32(env, req.result, &res);

  uv_fs_req_cleanup(&req);

  return res;
}

static js_value_t *
bare_fs_readv (js_env_t *env, js_callback_info_t *info) {
  size_t argc = 4;
  js_value_t *argv[4];

  js_get_callback_info(env, info, &argc, argv, NULL, NULL);

  bare_fs_req_t *req;
  js_get_typedarray_info(env, argv[0], NULL, (void **) &req, NULL, NULL, NULL);

  uint32_t fd;
  js_get_value_uint32(env, argv[1], &fd);

  js_value_t *arr = argv[2];
  js_value_t *item;

  int64_t pos;
  js_get_value_int64(env, argv[3], &pos);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  req->env = env;

  uint32_t bufs_len;
  js_get_array_length(env, arr, &bufs_len);

  uv_buf_t *bufs = malloc(sizeof(uv_buf_t) * bufs_len);

  for (uint32_t i = 0; i < bufs_len; i++) {
    js_get_element(env, arr, i, &item);

    uv_buf_t *buf = &bufs[i];
    js_get_typedarray_info(env, item, NULL, (void **) &buf->base, &buf->len, NULL, NULL);
  }

  uv_fs_read(loop, (uv_fs_t *) req, fd, bufs, bufs_len, pos, on_fs_response);

  free(bufs);

  return NULL;
}

static js_value_t *
bare_fs_ftruncate (js_env_t *env, js_callback_info_t *info) {
  size_t argc = 3;
  js_value_t *argv[3];

  js_get_callback_info(env, info, &argc, argv, NULL, NULL);

  bare_fs_req_t *req;
  js_get_typedarray_info(env, argv[0], NULL, (void **) &req, NULL, NULL, NULL);

  uint32_t fd;
  js_get_value_uint32(env, argv[1], &fd);

  int64_t len;
  js_get_value_int64(env, argv[2], &len);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  req->env = env;

  uv_fs_ftruncate(loop, (uv_fs_t *) req, fd, len, on_fs_response);

  return NULL;
}

static js_value_t *
bare_fs_close (js_env_t *env, js_callback_info_t *info) {
  size_t argc = 2;
  js_value_t *argv[2];

  js_get_callback_info(env, info, &argc, argv, NULL, NULL);

  bare_fs_req_t *req;
  js_get_typedarray_info(env, argv[0], NULL, (void **) &req, NULL, NULL, NULL);

  uint32_t fd;
  js_get_value_uint32(env, argv[1], &fd);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  req->env = env;

  uv_fs_close(loop, (uv_fs_t *) req, fd, on_fs_response);

  return NULL;
}

static js_value_t *
bare_fs_close_sync (js_env_t *env, js_callback_info_t *info) {
  size_t argc = 1;
  js_value_t *argv[1];

  js_get_callback_info(env, info, &argc, argv, NULL, NULL);

  uint32_t fd;
  js_get_value_uint32(env, argv[0], &fd);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  uv_fs_t req;
  uv_fs_close(loop, &req, fd, NULL);

  js_value_t *res;
  js_create_int32(env, req.result, &res);

  uv_fs_req_cleanup(&req);

  return res;
}

static js_value_t *
bare_fs_rename (js_env_t *env, js_callback_info_t *info) {
  size_t argc = 3;
  js_value_t *argv[3];

  js_get_callback_info(env, info, &argc, argv, NULL, NULL);

  bare_fs_req_t *req;
  js_get_typedarray_info(env, argv[0], NULL, (void **) &req, NULL, NULL, NULL);

  char src[4097];
  js_get_value_string_utf8(env, argv[1], src, 4096, NULL);

  char dest[4097];
  js_get_value_string_utf8(env, argv[2], dest, 4096, NULL);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  req->env = env;

  uv_fs_rename(loop, (uv_fs_t *) req, src, dest, on_fs_response);

  return NULL;
}

static js_value_t *
bare_fs_mkdir (js_env_t *env, js_callback_info_t *info) {
  size_t argc = 3;
  js_value_t *argv[3];

  js_get_callback_info(env, info, &argc, argv, NULL, NULL);

  bare_fs_req_t *req;
  js_get_typedarray_info(env, argv[0], NULL, (void **) &req, NULL, NULL, NULL);

  char path[4097];
  js_get_value_string_utf8(env, argv[1], path, 4096, NULL);

  int32_t mode;
  js_get_value_int32(env, argv[2], &mode);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  req->env = env;

  uv_fs_mkdir(loop, (uv_fs_t *) req, path, mode, on_fs_response);

  return NULL;
}

static js_value_t *
bare_fs_rmdir (js_env_t *env, js_callback_info_t *info) {
  size_t argc = 2;
  js_value_t *argv[2];

  js_get_callback_info(env, info, &argc, argv, NULL, NULL);

  bare_fs_req_t *req;
  js_get_typedarray_info(env, argv[0], NULL, (void **) &req, NULL, NULL, NULL);

  char path[4097];
  js_get_value_string_utf8(env, argv[1], path, 4096, NULL);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  req->env = env;

  uv_fs_rmdir(loop, (uv_fs_t *) req, path, on_fs_response);

  return NULL;
}

static js_value_t *
bare_fs_stat (js_env_t *env, js_callback_info_t *info) {
  size_t argc = 3;
  js_value_t *argv[3];

  js_get_callback_info(env, info, &argc, argv, NULL, NULL);

  bare_fs_req_t *req;
  js_get_typedarray_info(env, argv[0], NULL, (void **) &req, NULL, NULL, NULL);

  char path[4097];
  js_get_value_string_utf8(env, argv[1], path, 4096, NULL);

  void *data;
  size_t data_len;
  js_get_typedarray_info(env, argv[2], NULL, &data, &data_len, NULL, NULL);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  req->env = env;
  req->buf = uv_buf_init(data, data_len);

  uv_fs_stat(loop, (uv_fs_t *) req, path, on_fs_stat_response);

  return NULL;
}

static js_value_t *
bare_fs_stat_sync (js_env_t *env, js_callback_info_t *info) {
  size_t argc = 2;
  js_value_t *argv[2];

  js_get_callback_info(env, info, &argc, argv, NULL, NULL);

  char path[4097];
  js_get_value_string_utf8(env, argv[0], path, 4096, NULL);

  void *data;
  size_t data_len;
  js_get_typedarray_info(env, argv[1], NULL, &data, &data_len, NULL, NULL);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  uv_fs_t req;
  uv_fs_stat(loop, &req, path, NULL);

  js_value_t *res;
  js_create_int32(env, req.result, &res);

  uv_buf_t buf = uv_buf_init((char *) data, data_len);
  copy_stat(&req, &buf);

  uv_fs_req_cleanup(&req);

  return res;
}

static js_value_t *
bare_fs_lstat (js_env_t *env, js_callback_info_t *info) {
  size_t argc = 3;
  js_value_t *argv[3];

  js_get_callback_info(env, info, &argc, argv, NULL, NULL);

  bare_fs_req_t *req;
  js_get_typedarray_info(env, argv[0], NULL, (void **) &req, NULL, NULL, NULL);

  char path[4097];
  js_get_value_string_utf8(env, argv[1], path, 4096, NULL);

  void *data;
  size_t data_len;
  js_get_typedarray_info(env, argv[2], NULL, &data, &data_len, NULL, NULL);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  req->env = env;
  req->buf = uv_buf_init((char *) data, data_len);

  uv_fs_lstat(loop, (uv_fs_t *) req, path, on_fs_stat_response);

  return NULL;
}

static js_value_t *
bare_fs_lstat_sync (js_env_t *env, js_callback_info_t *info) {
  size_t argc = 2;
  js_value_t *argv[2];

  js_get_callback_info(env, info, &argc, argv, NULL, NULL);

  char path[4097];
  js_get_value_string_utf8(env, argv[0], path, 4096, NULL);

  void *data;
  size_t data_len;
  js_get_typedarray_info(env, argv[1], NULL, &data, &data_len, NULL, NULL);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  uv_fs_t req;
  uv_fs_lstat(loop, &req, path, NULL);

  js_value_t *res;
  js_create_int32(env, req.result, &res);

  uv_buf_t buf = uv_buf_init((char *) data, data_len);
  copy_stat(&req, &buf);

  uv_fs_req_cleanup(&req);

  return res;
}

static js_value_t *
bare_fs_fstat (js_env_t *env, js_callback_info_t *info) {
  size_t argc = 3;
  js_value_t *argv[3];

  js_get_callback_info(env, info, &argc, argv, NULL, NULL);

  bare_fs_req_t *req;
  js_get_typedarray_info(env, argv[0], NULL, (void **) &req, NULL, NULL, NULL);

  uint32_t fd;
  js_get_value_uint32(env, argv[1], &fd);

  void *data;
  size_t data_len;
  js_get_typedarray_info(env, argv[2], NULL, &data, &data_len, NULL, NULL);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  req->env = env;
  req->buf = uv_buf_init((char *) data, data_len);

  uv_fs_fstat(loop, (uv_fs_t *) req, fd, on_fs_stat_response);

  return NULL;
}

static js_value_t *
bare_fs_fstat_sync (js_env_t *env, js_callback_info_t *info) {
  size_t argc = 2;
  js_value_t *argv[2];

  js_get_callback_info(env, info, &argc, argv, NULL, NULL);

  uint32_t fd;
  js_get_value_uint32(env, argv[0], &fd);

  void *data;
  size_t data_len;
  js_get_typedarray_info(env, argv[1], NULL, &data, &data_len, NULL, NULL);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  uv_fs_t req;
  uv_fs_fstat(loop, &req, fd, NULL);

  js_value_t *res;
  js_create_int32(env, req.result, &res);

  uv_buf_t buf = uv_buf_init((char *) data, data_len);
  copy_stat(&req, &buf);

  uv_fs_req_cleanup(&req);

  return res;
}

static js_value_t *
bare_fs_unlink (js_env_t *env, js_callback_info_t *info) {
  size_t argc = 2;
  js_value_t *argv[2];

  js_get_callback_info(env, info, &argc, argv, NULL, NULL);

  bare_fs_req_t *req;
  js_get_typedarray_info(env, argv[0], NULL, (void **) &req, NULL, NULL, NULL);

  char path[4097];
  js_get_value_string_utf8(env, argv[1], path, 4096, NULL);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  req->env = env;

  uv_fs_unlink(loop, (uv_fs_t *) req, path, on_fs_response);

  return NULL;
}

static js_value_t *
bare_fs_readlink (js_env_t *env, js_callback_info_t *info) {
  size_t argc = 3;
  js_value_t *argv[3];

  js_get_callback_info(env, info, &argc, argv, NULL, NULL);

  bare_fs_req_t *req;
  js_get_typedarray_info(env, argv[0], NULL, (void **) &req, NULL, NULL, NULL);

  char path[4097];
  js_get_value_string_utf8(env, argv[1], path, 4096, NULL);

  void *data;
  size_t data_len;
  js_get_typedarray_info(env, argv[2], NULL, &data, &data_len, NULL, NULL);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  req->env = env;
  req->buf = uv_buf_init((char *) data, data_len);

  uv_fs_readlink(loop, (uv_fs_t *) req, path, on_fs_readlink_response);

  return NULL;
}

static js_value_t *
bare_fs_opendir (js_env_t *env, js_callback_info_t *info) {
  size_t argc = 3;
  js_value_t *argv[3];

  js_get_callback_info(env, info, &argc, argv, NULL, NULL);

  bare_fs_req_t *req;
  js_get_typedarray_info(env, argv[0], NULL, (void **) &req, NULL, NULL, NULL);

  char path[4097];
  js_get_value_string_utf8(env, argv[1], path, 4096, NULL);

  void *data;
  size_t data_len;
  js_get_typedarray_info(env, argv[2], NULL, &data, &data_len, NULL, NULL);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  req->env = env;
  req->buf = uv_buf_init((char *) data, data_len);

  uv_fs_opendir(loop, (uv_fs_t *) req, path, on_fs_opendir_response);

  return NULL;
}

static js_value_t *
bare_fs_readdir (js_env_t *env, js_callback_info_t *info) {
  size_t argc = 3;
  js_value_t *argv[3];

  js_get_callback_info(env, info, &argc, argv, NULL, NULL);

  bare_fs_req_t *req;
  js_get_typedarray_info(env, argv[0], NULL, (void **) &req, NULL, NULL, NULL);

  uv_dir_t **dir;
  js_get_typedarray_info(env, argv[1], NULL, (void **) &dir, NULL, NULL, NULL);

  void *data;
  size_t data_len;
  js_get_typedarray_info(env, argv[2], NULL, &data, &data_len, NULL, NULL);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  req->env = env;
  req->buf = uv_buf_init((char *) data, data_len);

  (*dir)->dirents = data;
  (*dir)->nentries = data_len / sizeof(uv_dirent_t);

  uv_fs_readdir(loop, (uv_fs_t *) req, *dir, on_fs_readdir_response);

  return NULL;
}

static js_value_t *
bare_fs_to_dirent (js_env_t *env, js_callback_info_t *info) {
  return NULL;
}

static js_value_t *
init (js_env_t *env, js_value_t *exports) {
  {
    js_value_t *val;
    js_create_uint32(env, sizeof(bare_fs_t), &val);
    js_set_named_property(env, exports, "sizeofFS", val);
  }
  {
    js_value_t *val;
    js_create_uint32(env, sizeof(bare_fs_req_t), &val);
    js_set_named_property(env, exports, "sizeofFSReq", val);
  }
  {
    js_value_t *val;
    js_create_uint32(env, offsetof(bare_fs_req_t, id), &val);
    js_set_named_property(env, exports, "offsetofFSReqID", val);
  }
  {
    js_value_t *val;
    js_create_uint32(env, sizeof(bare_fs_dir_t), &val);
    js_set_named_property(env, exports, "sizeofFSDir", val);
  }
  {
    js_value_t *val;
    js_create_uint32(env, sizeof(bare_fs_dirent_t), &val);
    js_set_named_property(env, exports, "sizeofFSDirent", val);
  }
  {
    js_value_t *fn;
    js_create_function(env, "init", -1, bare_fs_init, NULL, &fn);
    js_set_named_property(env, exports, "init", fn);
  }
  {
    js_value_t *fn;
    js_create_function(env, "destroy", -1, bare_fs_destroy, NULL, &fn);
    js_set_named_property(env, exports, "destroy", fn);
  }
  {
    js_value_t *fn;
    js_create_function(env, "initReq", -1, bare_fs_req_init, NULL, &fn);
    js_set_named_property(env, exports, "initReq", fn);
  }
  {
    js_value_t *fn;
    js_create_function(env, "open", -1, bare_fs_open, NULL, &fn);
    js_set_named_property(env, exports, "open", fn);
  }
  {
    js_value_t *fn;
    js_create_function(env, "openSync", -1, bare_fs_open_sync, NULL, &fn);
    js_set_named_property(env, exports, "openSync", fn);
  }
  {
    js_value_t *fn;
    js_create_function(env, "ftruncate", -1, bare_fs_ftruncate, NULL, &fn);
    js_set_named_property(env, exports, "ftruncate", fn);
  }
  {
    js_value_t *fn;
    js_create_function(env, "read", -1, bare_fs_read, NULL, &fn);
    js_set_named_property(env, exports, "read", fn);
  }
  {
    js_value_t *fn;
    js_create_function(env, "readSync", -1, bare_fs_read_sync, NULL, &fn);
    js_set_named_property(env, exports, "readSync", fn);
  }
  {
    js_value_t *fn;
    js_create_function(env, "readv", -1, bare_fs_readv, NULL, &fn);
    js_set_named_property(env, exports, "readv", fn);
  }
  {
    js_value_t *fn;
    js_create_function(env, "write", -1, bare_fs_write, NULL, &fn);
    js_set_named_property(env, exports, "write", fn);
  }
  {
    js_value_t *fn;
    js_create_function(env, "writeSync", -1, bare_fs_write_sync, NULL, &fn);
    js_set_named_property(env, exports, "writeSync", fn);
  }
  {
    js_value_t *fn;
    js_create_function(env, "writev", -1, bare_fs_writev, NULL, &fn);
    js_set_named_property(env, exports, "writev", fn);
  }
  {
    js_value_t *fn;
    js_create_function(env, "close", -1, bare_fs_close, NULL, &fn);
    js_set_named_property(env, exports, "close", fn);
  }
  {
    js_value_t *fn;
    js_create_function(env, "closeSync", -1, bare_fs_close_sync, NULL, &fn);
    js_set_named_property(env, exports, "closeSync", fn);
  }
  {
    js_value_t *fn;
    js_create_function(env, "rename", -1, bare_fs_rename, NULL, &fn);
    js_set_named_property(env, exports, "rename", fn);
  }
  {
    js_value_t *fn;
    js_create_function(env, "mkdir", -1, bare_fs_mkdir, NULL, &fn);
    js_set_named_property(env, exports, "mkdir", fn);
  }
  {
    js_value_t *fn;
    js_create_function(env, "rmdir", -1, bare_fs_rmdir, NULL, &fn);
    js_set_named_property(env, exports, "rmdir", fn);
  }
  {
    js_value_t *fn;
    js_create_function(env, "stat", -1, bare_fs_stat, NULL, &fn);
    js_set_named_property(env, exports, "stat", fn);
  }
  {
    js_value_t *fn;
    js_create_function(env, "statSync", -1, bare_fs_stat_sync, NULL, &fn);
    js_set_named_property(env, exports, "statSync", fn);
  }
  {
    js_value_t *fn;
    js_create_function(env, "lstat", -1, bare_fs_lstat, NULL, &fn);
    js_set_named_property(env, exports, "lstat", fn);
  }
  {
    js_value_t *fn;
    js_create_function(env, "lstatSync", -1, bare_fs_lstat_sync, NULL, &fn);
    js_set_named_property(env, exports, "lstatSync", fn);
  }
  {
    js_value_t *fn;
    js_create_function(env, "fstat", -1, bare_fs_fstat, NULL, &fn);
    js_set_named_property(env, exports, "fstat", fn);
  }
  {
    js_value_t *fn;
    js_create_function(env, "fstatSync", -1, bare_fs_fstat_sync, NULL, &fn);
    js_set_named_property(env, exports, "fstatSync", fn);
  }
  {
    js_value_t *fn;
    js_create_function(env, "unlink", -1, bare_fs_unlink, NULL, &fn);
    js_set_named_property(env, exports, "unlink", fn);
  }
  {
    js_value_t *fn;
    js_create_function(env, "readlink", -1, bare_fs_readlink, NULL, &fn);
    js_set_named_property(env, exports, "readlink", fn);
  }
  {
    js_value_t *fn;
    js_create_function(env, "opendir", -1, bare_fs_opendir, NULL, &fn);
    js_set_named_property(env, exports, "opendir", fn);
  }
  {
    js_value_t *fn;
    js_create_function(env, "readdir", -1, bare_fs_readdir, NULL, &fn);
    js_set_named_property(env, exports, "readdir", fn);
  }
  {
    js_value_t *fn;
    js_create_function(env, "toDirent", -1, bare_fs_to_dirent, NULL, &fn);
    js_set_named_property(env, exports, "toDirent", fn);
  }
  {
    js_value_t *val;
    js_create_uint32(env, O_RDWR, &val);
    js_set_named_property(env, exports, "O_RDWR", val);
  }
  {
    js_value_t *val;
    js_create_uint32(env, O_RDONLY, &val);
    js_set_named_property(env, exports, "O_RDONLY", val);
  }
  {
    js_value_t *val;
    js_create_uint32(env, O_WRONLY, &val);
    js_set_named_property(env, exports, "O_WRONLY", val);
  }
  {
    js_value_t *val;
    js_create_uint32(env, O_CREAT, &val);
    js_set_named_property(env, exports, "O_CREAT", val);
  }
  {
    js_value_t *val;
    js_create_uint32(env, O_TRUNC, &val);
    js_set_named_property(env, exports, "O_TRUNC", val);
  }
  {
    js_value_t *val;
    js_create_uint32(env, O_APPEND, &val);
    js_set_named_property(env, exports, "O_APPEND", val);
  }
  {
    js_value_t *val;
    js_create_uint32(env, S_IFMT, &val);
    js_set_named_property(env, exports, "S_IFMT", val);
  }
  {
    js_value_t *val;
    js_create_uint32(env, S_IFREG, &val);
    js_set_named_property(env, exports, "S_IFREG", val);
  }
  {
    js_value_t *val;
    js_create_uint32(env, S_IFDIR, &val);
    js_set_named_property(env, exports, "S_IFDIR", val);
  }
  {
    js_value_t *val;
    js_create_uint32(env, S_IFCHR, &val);
    js_set_named_property(env, exports, "S_IFCHR", val);
  }
  {
    js_value_t *val;
    js_create_uint32(env, S_IFLNK, &val);
    js_set_named_property(env, exports, "S_IFLNK", val);
  }
#ifndef _WIN32
  {
    js_value_t *val;
    js_create_uint32(env, S_IFBLK, &val);
    js_set_named_property(env, exports, "S_IFBLK", val);
  }
  {
    js_value_t *val;
    js_create_uint32(env, S_IFIFO, &val);
    js_set_named_property(env, exports, "S_IFIFO", val);
  }
  {
    js_value_t *val;
    js_create_uint32(env, S_IFSOCK, &val);
    js_set_named_property(env, exports, "S_IFSOCK", val);
  }
#endif

  return exports;
}

BARE_MODULE(bare_fs, init)
