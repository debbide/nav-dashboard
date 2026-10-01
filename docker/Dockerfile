# ============ 构建阶段 ============
FROM node:22-alpine AS builder

# 安装 better-sqlite3 编译依赖
RUN apk add --no-cache python3 make g++

WORKDIR /app

# 复制依赖文件
COPY package*.json ./

# 安装生产依赖（包括编译原生模块）
RUN npm install --only=production

# ============ 运行阶段 ============
FROM node:22-alpine

WORKDIR /app

# 只复制必要的运行时文件
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY server ./server
COPY public ./public

# 创建数据目录并设置权限，安装 curl（健康检查）与 su-exec（降权）用
RUN mkdir -p /app/data /app/uploads && chmod 755 /app/uploads /app/data && apk add --no-cache curl su-exec

# 入口脚本：修好挂载卷权限后降权运行（兼容旧版 root 容器留下的数据卷）
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -fsS http://localhost:3000/health/ready || exit 1

# 启动命令（entrypoint 会降权到 node 用户再 exec）
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server/index.js"]
