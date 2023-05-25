#include <assert.h>
#include <bare.h>
#include <js.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <utf.h>
#include <uv.h>

/**
 * Per-thread singleton response handler that all file system requests
 * reference.
 */
typedef struct {
  js_env_t *env;
  js_ref_t *ctx;
  js_ref_t *on_response;
} bare_fs_t;

typedef struct {
  uv_fs_t req;

  js_env_t *env;
  js_ref_t *ctx;
  js_ref_t *on_response;

  uint32_t id;

  js_ref_t *data;
} bare_fs_req_t;

typedef utf8_t bare_fs_path_t[4096 + 1 /* NULL */];

typedef struct {
  uv_dir_t *dir;
} bare_fs_dir_t;

typedef uv_dirent_t bare_fs_dirent_t;

static inline void
on_fs_response (uv_fs_t *uv_req) {
  int err;

  bare_fs_req_t *req = (bare_fs_req_t *) uv_req;

  js_env_t *env = req->env;

  js_handle_scope_t *scope;
  err = js_open_handle_scope(env, &scope);
  assert(err == 0);

  js_value_t *on_response;
  err = js_get_reference_value(env, req->on_response, &on_response);
  assert(err == 0);

  js_value_t *ctx;
  err = js_get_reference_value(env, req->ctx, &ctx);
  assert(err == 0);

  js_value_t *argv[2];

  err = js_create_uint32(env, req->id, &argv[0]);
  assert(err == 0);

  err = js_create_int32(env, uv_req->result, &argv[1]);
  assert(err == 0);

  uv_fs_req_cleanup(uv_req);

  if (req->data) {
    err = js_delete_reference(env, req->data);
    assert(err == 0);

    req->data = NULL;
  }

  js_call_function(req->env, ctx, on_response, 2, argv, NULL);

  err = js_close_handle_scope(req->env, scope);
  assert(err == 0);
}

static void
on_fs_stat_response (uv_fs_t *uv_req) {
  int err;

  bare_fs_req_t *req = (bare_fs_req_t *) uv_req;

  js_env_t *env = req->env;

  if (uv_req->result == 0) {
    js_value_t *data;
    err = js_get_reference_value(env, req->data, &data);
    assert(err == 0);

    uint32_t i = 0;

#define V(property) \
  { \
    js_value_t *value; \
    err = js_create_int64(env, uv_req->statbuf.st_##property, &value); \
    assert(err == 0); \
\
    err = js_set_element(env, data, i++, value); \
    assert(err == 0); \
  }
    V(dev)
    V(mode)
    V(nlink)
    V(uid)
    V(gid)
    V(rdev)
    V(blksize)
    V(ino)
    V(size)
    V(blocks)
#undef V

#define V(property) \
  { \
    uv_timespec_t time = uv_req->statbuf.st_##property; \
\
    js_value_t *value; \
    err = js_create_int64(env, time.tv_sec * 1e3 + time.tv_nsec / 1e6, &value); \
    assert(err == 0); \
\
    err = js_set_element(env, data, i++, value); \
    assert(err == 0); \
  }
    V(atim)
    V(mtim)
    V(ctim)
    V(birthtim)
#undef V
  }

  on_fs_response(uv_req);
}

static void
on_fs_readlink_response (uv_fs_t *uv_req) {
  int err;

  bare_fs_req_t *req = (bare_fs_req_t *) uv_req;

  js_env_t *env = req->env;

  if (uv_req->result == 0) {
    js_value_t *data;
    err = js_get_reference_value(env, req->data, &data);
    assert(err == 0);

    char *path;
    err = js_get_typedarray_info(env, data, NULL, (void **) &path, NULL, NULL, NULL);
    assert(err == 0);

    strncpy(path, uv_req->ptr, sizeof(bare_fs_path_t));
  }

  on_fs_response(uv_req);
}

static void
on_fs_opendir_response (uv_fs_t *uv_req) {
  int err;

  bare_fs_req_t *req = (bare_fs_req_t *) uv_req;

  js_env_t *env = req->env;

  if (uv_req->result == 0) {
    js_value_t *data;
    err = js_get_reference_value(env, req->data, &data);
    assert(err == 0);

    bare_fs_dir_t *dir;
    err = js_get_typedarray_info(env, data, NULL, (void **) &dir, NULL, NULL, NULL);
    assert(err == 0);

    dir->dir = uv_req->ptr;
  }

  on_fs_response(uv_req);
}

static void
on_fs_readdir_response (uv_fs_t *uv_req) {
  int err;

  bare_fs_req_t *req = (bare_fs_req_t *) uv_req;

  js_env_t *env = req->env;

  if (uv_req->result > 0) {
    js_value_t *data;
    err = js_get_reference_value(env, req->data, &data);
    assert(err == 0);

    uv_dir_t *dir = uv_req->ptr;

    for (size_t i = 0, n = uv_req->result; i < n; i++) {
      uv_dirent_t *dirent = &dir->dirents[i];

      js_value_t *entry;
      err = js_create_object(env, &entry);
      assert(err == 0);

      err = js_set_element(env, data, i, entry);
      assert(err == 0);

      js_value_t *name;
      void *data;
      err = js_create_arraybuffer(env, strlen(dirent->name), &data, &name);
      assert(err == 0);

      strcpy(data, dirent->name);

      err = js_set_named_property(env, entry, "name", name);
      assert(err == 0);

      js_value_t *type;
      err = js_create_uint32(env, dirent->type, &type);
      assert(err == 0);

      err = js_set_named_property(env, entry, "type", type);
      assert(err == 0);
    }
  }

  on_fs_response(uv_req);
}

static js_value_t *
bare_fs_init (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 3;
  js_value_t *argv[3];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 3);

  bare_fs_t *fs;
  err = js_get_typedarray_info(env, argv[0], NULL, (void **) &fs, NULL, NULL, NULL);
  assert(err == 0);

  fs->env = env;

  err = js_create_reference(env, argv[1], 1, &fs->ctx);
  assert(err == 0);

  err = js_create_reference(env, argv[2], 1, &fs->on_response);
  assert(err == 0);

  return NULL;
}

static js_value_t *
bare_fs_destroy (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  bare_fs_t *fs;
  err = js_get_typedarray_info(env, argv[0], NULL, (void **) &fs, NULL, NULL, NULL);
  assert(err == 0);

  err = js_delete_reference(env, fs->on_response);
  assert(err == 0);

  err = js_delete_reference(env, fs->ctx);
  assert(err == 0);

  return NULL;
}

static js_value_t *
bare_fs_req_init (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 2;
  js_value_t *argv[2];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  bare_fs_t *fs;
  err = js_get_typedarray_info(env, argv[0], NULL, (void **) &fs, NULL, NULL, NULL);
  assert(err == 0);

  bare_fs_req_t *req;
  err = js_get_typedarray_info(env, argv[1], NULL, (void **) &req, NULL, NULL, NULL);
  assert(err == 0);

  // Copy the singleton response handler to the request.
  req->env = fs->env;
  req->ctx = fs->ctx;
  req->on_response = fs->on_response;

  return NULL;
}

static js_value_t *
bare_fs_open (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 4;
  js_value_t *argv[4];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 4);

  bare_fs_req_t *req;
  err = js_get_typedarray_info(env, argv[0], NULL, (void **) &req, NULL, NULL, NULL);
  assert(err == 0);

  bare_fs_path_t path;
  err = js_get_value_string_utf8(env, argv[1], path, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  int32_t flags;
  err = js_get_value_int32(env, argv[2], &flags);
  assert(err == 0);

  int32_t mode;
  err = js_get_value_int32(env, argv[3], &mode);
  assert(err == 0);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  uv_fs_open(loop, (uv_fs_t *) req, (char *) path, flags, mode, on_fs_response);

  return NULL;
}

static js_value_t *
bare_fs_open_sync (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 3;
  js_value_t *argv[3];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 3);

  bare_fs_path_t path;
  err = js_get_value_string_utf8(env, argv[0], path, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  int32_t flags;
  err = js_get_value_int32(env, argv[1], &flags);
  assert(err == 0);

  int32_t mode;
  err = js_get_value_int32(env, argv[2], &mode);
  assert(err == 0);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  uv_fs_t req;
  uv_fs_open(loop, &req, (char *) path, flags, mode, NULL);

  js_value_t *res;
  err = js_create_int32(env, req.result, &res);
  assert(err == 0);

  uv_fs_req_cleanup(&req);

  return res;
}

static js_value_t *
bare_fs_close (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 2;
  js_value_t *argv[2];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  bare_fs_req_t *req;
  err = js_get_typedarray_info(env, argv[0], NULL, (void **) &req, NULL, NULL, NULL);
  assert(err == 0);

  uint32_t fd;
  err = js_get_value_uint32(env, argv[1], &fd);
  assert(err == 0);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  uv_fs_close(loop, (uv_fs_t *) req, fd, on_fs_response);

  return NULL;
}

static js_value_t *
bare_fs_close_sync (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  uint32_t fd;
  err = js_get_value_uint32(env, argv[0], &fd);
  assert(err == 0);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  uv_fs_t req;
  uv_fs_close(loop, &req, fd, NULL);

  js_value_t *res;
  err = js_create_int32(env, req.result, &res);
  assert(err == 0);

  uv_fs_req_cleanup(&req);

  return res;
}

static js_value_t *
bare_fs_read (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 6;
  js_value_t *argv[6];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 6);

  bare_fs_req_t *req;
  err = js_get_typedarray_info(env, argv[0], NULL, (void **) &req, NULL, NULL, NULL);
  assert(err == 0);

  uint32_t fd;
  err = js_get_value_uint32(env, argv[1], &fd);
  assert(err == 0);

  void *data;
  err = js_get_typedarray_info(env, argv[2], NULL, &data, NULL, NULL, NULL);
  assert(err == 0);

  uint32_t offset;
  err = js_get_value_uint32(env, argv[3], &offset);
  assert(err == 0);

  uint32_t len;
  err = js_get_value_uint32(env, argv[4], &len);
  assert(err == 0);

  int64_t pos;
  err = js_get_value_int64(env, argv[5], &pos);
  assert(err == 0);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  uv_buf_t buf = uv_buf_init(data + offset, len);

  uv_fs_read(loop, (uv_fs_t *) req, fd, &buf, 1, pos, on_fs_response);

  return NULL;
}

static js_value_t *
bare_fs_read_sync (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 5;
  js_value_t *argv[5];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 5);

  uint32_t fd;
  err = js_get_value_uint32(env, argv[0], &fd);
  assert(err == 0);

  void *data;
  err = js_get_typedarray_info(env, argv[1], NULL, &data, NULL, NULL, NULL);
  assert(err == 0);

  uint32_t offset;
  err = js_get_value_uint32(env, argv[2], &offset);
  assert(err == 0);

  uint32_t len;
  err = js_get_value_uint32(env, argv[3], &len);
  assert(err == 0);

  int64_t pos;
  err = js_get_value_int64(env, argv[4], &pos);
  assert(err == 0);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  uv_buf_t buf = uv_buf_init(data + offset, len);

  uv_fs_t req;
  uv_fs_read(loop, (uv_fs_t *) &req, fd, &buf, 1, pos, NULL);

  js_value_t *res;
  err = js_create_int32(env, req.result, &res);
  assert(err == 0);

  uv_fs_req_cleanup(&req);

  return res;
}

static js_value_t *
bare_fs_readv (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 4;
  js_value_t *argv[4];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 4);

  bare_fs_req_t *req;
  err = js_get_typedarray_info(env, argv[0], NULL, (void **) &req, NULL, NULL, NULL);
  assert(err == 0);

  uint32_t fd;
  err = js_get_value_uint32(env, argv[1], &fd);
  assert(err == 0);

  js_value_t *arr = argv[2];
  js_value_t *item;

  int64_t pos;
  err = js_get_value_int64(env, argv[3], &pos);
  assert(err == 0);

  err = js_create_reference(env, arr, 1, &req->data);
  assert(err == 0);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  uint32_t bufs_len;
  err = js_get_array_length(env, arr, &bufs_len);
  assert(err == 0);

  uv_buf_t *bufs = malloc(sizeof(uv_buf_t) * bufs_len);

  for (uint32_t i = 0; i < bufs_len; i++) {
    err = js_get_element(env, arr, i, &item);
    assert(err == 0);

    uv_buf_t *buf = &bufs[i];
    err = js_get_typedarray_info(env, item, NULL, (void **) &buf->base, &buf->len, NULL, NULL);
    assert(err == 0);
  }

  uv_fs_read(loop, (uv_fs_t *) req, fd, bufs, bufs_len, pos, on_fs_response);

  free(bufs);

  return NULL;
}

static js_value_t *
bare_fs_write (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 6;
  js_value_t *argv[6];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 6);

  bare_fs_req_t *req;
  err = js_get_typedarray_info(env, argv[0], NULL, (void **) &req, NULL, NULL, NULL);
  assert(err == 0);

  uint32_t fd;
  err = js_get_value_uint32(env, argv[1], &fd);
  assert(err == 0);

  void *data;
  err = js_get_typedarray_info(env, argv[2], NULL, &data, NULL, NULL, NULL);
  assert(err == 0);

  uint32_t offset;
  err = js_get_value_uint32(env, argv[3], &offset);
  assert(err == 0);

  uint32_t len;
  err = js_get_value_uint32(env, argv[4], &len);
  assert(err == 0);

  int64_t pos;
  err = js_get_value_int64(env, argv[5], &pos);
  assert(err == 0);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  uv_buf_t buf = uv_buf_init(data + offset, len);

  uv_fs_write(loop, (uv_fs_t *) req, fd, &buf, 1, pos, on_fs_response);

  return NULL;
}

static js_value_t *
bare_fs_write_sync (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 5;
  js_value_t *argv[5];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 5);

  uint32_t fd;
  err = js_get_value_uint32(env, argv[0], &fd);
  assert(err == 0);

  void *data;
  err = js_get_typedarray_info(env, argv[1], NULL, &data, NULL, NULL, NULL);
  assert(err == 0);

  uint32_t offset;
  err = js_get_value_uint32(env, argv[2], &offset);
  assert(err == 0);

  uint32_t len;
  err = js_get_value_uint32(env, argv[3], &len);
  assert(err == 0);

  int64_t pos;
  err = js_get_value_int64(env, argv[4], &pos);
  assert(err == 0);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  uv_buf_t buf = uv_buf_init(data + offset, len);

  uv_fs_t req;
  uv_fs_write(loop, &req, fd, &buf, 1, pos, NULL);

  js_value_t *res;
  err = js_create_int32(env, req.result, &res);
  assert(err == 0);

  uv_fs_req_cleanup(&req);

  return res;
}

static js_value_t *
bare_fs_writev (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 4;
  js_value_t *argv[4];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 4);

  bare_fs_req_t *req;
  err = js_get_typedarray_info(env, argv[0], NULL, (void **) &req, NULL, NULL, NULL);
  assert(err == 0);

  uint32_t fd;
  err = js_get_value_uint32(env, argv[1], &fd);
  assert(err == 0);

  js_value_t *arr = argv[2];
  js_value_t *item;

  int64_t pos;
  err = js_get_value_int64(env, argv[3], &pos);
  assert(err == 0);

  err = js_create_reference(env, arr, 1, &req->data);
  assert(err == 0);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  uint32_t bufs_len;
  err = js_get_array_length(env, arr, &bufs_len);
  assert(err == 0);

  uv_buf_t *bufs = malloc(sizeof(uv_buf_t) * bufs_len);

  for (uint32_t i = 0; i < bufs_len; i++) {
    err = js_get_element(env, arr, i, &item);
    assert(err == 0);

    uv_buf_t *buf = &bufs[i];
    err = js_get_typedarray_info(env, item, NULL, (void **) &buf->base, &buf->len, NULL, NULL);
    assert(err == 0);
  }

  uv_fs_write(loop, (uv_fs_t *) req, fd, bufs, bufs_len, pos, on_fs_response);

  free(bufs);

  return NULL;
}

static js_value_t *
bare_fs_ftruncate (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 3;
  js_value_t *argv[3];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 3);

  bare_fs_req_t *req;
  err = js_get_typedarray_info(env, argv[0], NULL, (void **) &req, NULL, NULL, NULL);
  assert(err == 0);

  uint32_t fd;
  err = js_get_value_uint32(env, argv[1], &fd);
  assert(err == 0);

  int64_t len;
  err = js_get_value_int64(env, argv[2], &len);
  assert(err == 0);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  uv_fs_ftruncate(loop, (uv_fs_t *) req, fd, len, on_fs_response);

  return NULL;
}

static js_value_t *
bare_fs_rename (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 3;
  js_value_t *argv[3];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 3);

  bare_fs_req_t *req;
  err = js_get_typedarray_info(env, argv[0], NULL, (void **) &req, NULL, NULL, NULL);
  assert(err == 0);

  bare_fs_path_t src;
  err = js_get_value_string_utf8(env, argv[1], src, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  bare_fs_path_t dest;
  err = js_get_value_string_utf8(env, argv[2], dest, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  uv_fs_rename(loop, (uv_fs_t *) req, (char *) src, (char *) dest, on_fs_response);

  return NULL;
}

static js_value_t *
bare_fs_mkdir (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 3;
  js_value_t *argv[3];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 3);

  bare_fs_req_t *req;
  err = js_get_typedarray_info(env, argv[0], NULL, (void **) &req, NULL, NULL, NULL);
  assert(err == 0);

  bare_fs_path_t path;
  err = js_get_value_string_utf8(env, argv[1], path, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  int32_t mode;
  err = js_get_value_int32(env, argv[2], &mode);
  assert(err == 0);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  uv_fs_mkdir(loop, (uv_fs_t *) req, (char *) path, mode, on_fs_response);

  return NULL;
}

static js_value_t *
bare_fs_rmdir (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 2;
  js_value_t *argv[2];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  bare_fs_req_t *req;
  err = js_get_typedarray_info(env, argv[0], NULL, (void **) &req, NULL, NULL, NULL);
  assert(err == 0);

  bare_fs_path_t path;
  err = js_get_value_string_utf8(env, argv[1], path, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  uv_fs_rmdir(loop, (uv_fs_t *) req, (char *) path, on_fs_response);

  return NULL;
}

static js_value_t *
bare_fs_stat (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 3;
  js_value_t *argv[3];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 3);

  bare_fs_req_t *req;
  err = js_get_typedarray_info(env, argv[0], NULL, (void **) &req, NULL, NULL, NULL);
  assert(err == 0);

  bare_fs_path_t path;
  err = js_get_value_string_utf8(env, argv[1], path, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  err = js_create_reference(env, argv[2], 1, &req->data);
  assert(err == 0);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  uv_fs_stat(loop, (uv_fs_t *) req, (char *) path, on_fs_stat_response);

  return NULL;
}

static js_value_t *
bare_fs_stat_sync (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 2;
  js_value_t *argv[2];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  bare_fs_path_t path;
  err = js_get_value_string_utf8(env, argv[0], path, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  js_value_t *data = argv[1];

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  uv_fs_t req;
  uv_fs_stat(loop, &req, (char *) path, NULL);

  if (req.result == 0) {
    uint32_t i = 0;

#define V(property) \
  { \
    js_value_t *value; \
    err = js_create_int64(env, req.statbuf.st_##property, &value); \
    assert(err == 0); \
\
    err = js_set_element(env, data, i++, value); \
    assert(err == 0); \
  }
    V(dev)
    V(mode)
    V(nlink)
    V(uid)
    V(gid)
    V(rdev)
    V(blksize)
    V(ino)
    V(size)
    V(blocks)
#undef V

#define V(property) \
  { \
    uv_timespec_t time = req.statbuf.st_##property; \
\
    js_value_t *value; \
    err = js_create_int64(env, time.tv_sec * 1e3 + time.tv_nsec / 1e6, &value); \
    assert(err == 0); \
\
    err = js_set_element(env, data, i++, value); \
    assert(err == 0); \
  }
    V(atim)
    V(mtim)
    V(ctim)
    V(birthtim)
#undef V
  }

  js_value_t *res;
  err = js_create_int32(env, req.result, &res);
  assert(err == 0);

  uv_fs_req_cleanup(&req);

  return res;
}

static js_value_t *
bare_fs_lstat (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 3;
  js_value_t *argv[3];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 3);

  bare_fs_req_t *req;
  err = js_get_typedarray_info(env, argv[0], NULL, (void **) &req, NULL, NULL, NULL);
  assert(err == 0);

  bare_fs_path_t path;
  err = js_get_value_string_utf8(env, argv[1], path, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  err = js_create_reference(env, argv[2], 1, &req->data);
  assert(err == 0);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  uv_fs_lstat(loop, (uv_fs_t *) req, (char *) path, on_fs_stat_response);

  return NULL;
}

static js_value_t *
bare_fs_lstat_sync (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 2;
  js_value_t *argv[2];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  bare_fs_path_t path;
  err = js_get_value_string_utf8(env, argv[0], path, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  js_value_t *data = argv[1];

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  uv_fs_t req;
  uv_fs_lstat(loop, &req, (char *) path, NULL);

  if (req.result == 0) {
    uint32_t i = 0;

#define V(property) \
  { \
    js_value_t *value; \
    err = js_create_int64(env, req.statbuf.st_##property, &value); \
    assert(err == 0); \
\
    err = js_set_element(env, data, i++, value); \
    assert(err == 0); \
  }
    V(dev)
    V(mode)
    V(nlink)
    V(uid)
    V(gid)
    V(rdev)
    V(blksize)
    V(ino)
    V(size)
    V(blocks)
#undef V

#define V(property) \
  { \
    uv_timespec_t time = req.statbuf.st_##property; \
\
    js_value_t *value; \
    err = js_create_int64(env, time.tv_sec * 1e3 + time.tv_nsec / 1e6, &value); \
    assert(err == 0); \
\
    err = js_set_element(env, data, i++, value); \
    assert(err == 0); \
  }
    V(atim)
    V(mtim)
    V(ctim)
    V(birthtim)
#undef V
  }

  js_value_t *res;
  err = js_create_int32(env, req.result, &res);
  assert(err == 0);

  uv_fs_req_cleanup(&req);

  return res;
}

static js_value_t *
bare_fs_fstat (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 3;
  js_value_t *argv[3];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 3);

  bare_fs_req_t *req;
  err = js_get_typedarray_info(env, argv[0], NULL, (void **) &req, NULL, NULL, NULL);
  assert(err == 0);

  uint32_t fd;
  err = js_get_value_uint32(env, argv[1], &fd);
  assert(err == 0);

  err = js_create_reference(env, argv[2], 1, &req->data);
  assert(err == 0);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  uv_fs_fstat(loop, (uv_fs_t *) req, fd, on_fs_stat_response);

  return NULL;
}

static js_value_t *
bare_fs_fstat_sync (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 2;
  js_value_t *argv[2];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  uint32_t fd;
  err = js_get_value_uint32(env, argv[0], &fd);
  assert(err == 0);

  js_value_t *data = argv[1];

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  uv_fs_t req;
  uv_fs_fstat(loop, &req, fd, NULL);

  if (req.result == 0) {
    uint32_t i = 0;

#define V(property) \
  { \
    js_value_t *value; \
    err = js_create_int64(env, req.statbuf.st_##property, &value); \
    assert(err == 0); \
\
    err = js_set_element(env, data, i++, value); \
    assert(err == 0); \
  }
    V(dev)
    V(mode)
    V(nlink)
    V(uid)
    V(gid)
    V(rdev)
    V(blksize)
    V(ino)
    V(size)
    V(blocks)
#undef V

#define V(property) \
  { \
    uv_timespec_t time = req.statbuf.st_##property; \
\
    js_value_t *value; \
    err = js_create_int64(env, time.tv_sec * 1e3 + time.tv_nsec / 1e6, &value); \
    assert(err == 0); \
\
    err = js_set_element(env, data, i++, value); \
    assert(err == 0); \
  }
    V(atim)
    V(mtim)
    V(ctim)
    V(birthtim)
#undef V
  }

  js_value_t *res;
  err = js_create_int32(env, req.result, &res);
  assert(err == 0);

  uv_fs_req_cleanup(&req);

  return res;
}

static js_value_t *
bare_fs_unlink (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 2;
  js_value_t *argv[2];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  bare_fs_req_t *req;
  err = js_get_typedarray_info(env, argv[0], NULL, (void **) &req, NULL, NULL, NULL);
  assert(err == 0);

  bare_fs_path_t path;
  err = js_get_value_string_utf8(env, argv[1], path, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  uv_fs_unlink(loop, (uv_fs_t *) req, (char *) path, on_fs_response);

  return NULL;
}

static js_value_t *
bare_fs_readlink (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 3;
  js_value_t *argv[3];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 3);

  bare_fs_req_t *req;
  err = js_get_typedarray_info(env, argv[0], NULL, (void **) &req, NULL, NULL, NULL);
  assert(err == 0);

  bare_fs_path_t path;
  err = js_get_value_string_utf8(env, argv[1], path, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  err = js_create_reference(env, argv[2], 1, &req->data);
  assert(err == 0);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  uv_fs_readlink(loop, (uv_fs_t *) req, (char *) path, on_fs_readlink_response);

  return NULL;
}

static js_value_t *
bare_fs_readlink_sync (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 2;
  js_value_t *argv[2];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  bare_fs_path_t path;
  err = js_get_value_string_utf8(env, argv[0], path, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  js_value_t *data = argv[1];

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  uv_fs_t req;
  uv_fs_readlink(loop, &req, (char *) path, NULL);

  if (req.result == 0) {
    char *path;
    err = js_get_typedarray_info(env, data, NULL, (void **) &path, NULL, NULL, NULL);
    assert(err == 0);

    strncpy(path, req.ptr, sizeof(bare_fs_path_t));
  }

  js_value_t *res;
  err = js_create_int32(env, req.result, &res);
  assert(err == 0);

  uv_fs_req_cleanup(&req);

  return res;
}

static js_value_t *
bare_fs_opendir (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 3;
  js_value_t *argv[3];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 3);

  bare_fs_req_t *req;
  err = js_get_typedarray_info(env, argv[0], NULL, (void **) &req, NULL, NULL, NULL);
  assert(err == 0);

  bare_fs_path_t path;
  err = js_get_value_string_utf8(env, argv[1], path, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  err = js_create_reference(env, argv[2], 1, &req->data);
  assert(err == 0);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  uv_fs_opendir(loop, (uv_fs_t *) req, (char *) path, on_fs_opendir_response);

  return NULL;
}

static js_value_t *
bare_fs_readdir (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 4;
  js_value_t *argv[4];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 4);

  bare_fs_req_t *req;
  err = js_get_typedarray_info(env, argv[0], NULL, (void **) &req, NULL, NULL, NULL);
  assert(err == 0);

  bare_fs_dir_t *dir;
  err = js_get_typedarray_info(env, argv[1], NULL, (void **) &dir, NULL, NULL, NULL);
  assert(err == 0);

  bare_fs_dirent_t *dirents;
  size_t dirents_len;
  err = js_get_typedarray_info(env, argv[2], NULL, (void **) &dirents, &dirents_len, NULL, NULL);
  assert(err == 0);

  err = js_create_reference(env, argv[3], 1, &req->data);
  assert(err == 0);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  dir->dir->dirents = dirents;
  dir->dir->nentries = dirents_len / sizeof(bare_fs_dirent_t);

  uv_fs_readdir(loop, (uv_fs_t *) req, dir->dir, on_fs_readdir_response);

  return NULL;
}

static js_value_t *
bare_fs_closedir (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 2;
  js_value_t *argv[2];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  bare_fs_req_t *req;
  err = js_get_typedarray_info(env, argv[0], NULL, (void **) &req, NULL, NULL, NULL);
  assert(err == 0);

  bare_fs_dir_t *dir;
  err = js_get_typedarray_info(env, argv[1], NULL, (void **) &dir, NULL, NULL, NULL);
  assert(err == 0);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  uv_fs_closedir(loop, (uv_fs_t *) req, dir->dir, on_fs_response);

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
    js_value_t *val;
    js_create_uint32(env, sizeof(bare_fs_path_t), &val);
    js_set_named_property(env, exports, "sizeofFSPath", val);
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
    js_create_function(env, "ftruncate", -1, bare_fs_ftruncate, NULL, &fn);
    js_set_named_property(env, exports, "ftruncate", fn);
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
    js_create_function(env, "readlinkSync", -1, bare_fs_readlink_sync, NULL, &fn);
    js_set_named_property(env, exports, "readlinkSync", fn);
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
    js_create_function(env, "closedir", -1, bare_fs_closedir, NULL, &fn);
    js_set_named_property(env, exports, "closedir", fn);
  }
#define V(name) \
  { \
    js_value_t *val; \
    js_create_uint32(env, name, &val); \
    js_set_named_property(env, exports, #name, val); \
  }
  V(O_RDWR)
  V(O_RDONLY)
  V(O_WRONLY)
  V(O_CREAT)
  V(O_TRUNC)
  V(O_APPEND)

  V(S_IFMT)
  V(S_IFREG)
  V(S_IFDIR)
  V(S_IFCHR)
  V(S_IFLNK)
#ifndef _WIN32
  V(S_IFBLK)
  V(S_IFIFO)
  V(S_IFSOCK)
#endif

  V(UV_DIRENT_UNKNOWN)
  V(UV_DIRENT_FILE)
  V(UV_DIRENT_DIR)
  V(UV_DIRENT_LINK)
  V(UV_DIRENT_FIFO)
  V(UV_DIRENT_SOCKET)
  V(UV_DIRENT_CHAR)
  V(UV_DIRENT_BLOCK)
#undef V

  return exports;
}

BARE_MODULE(bare_fs, init)
