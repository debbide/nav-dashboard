#!/bin/sh
# nav-dashboard 入口脚本
# 容器以 root 启动时，先把数据卷属主修给 node 用户（兼容旧版 root 容器留下的数据），
# 再降权执行 CMD；本身已是非 root 时直接执行。
set -e

if [ "$(id -u)" = "0" ]; then
    chown -R node:node /app/data /app/uploads 2>/dev/null || true
    exec su-exec node "$@"
fi

exec "$@"
