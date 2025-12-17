# ============ 构建阶段 ============
FROM node:18-alpine AS builder

# 安装 better-sqlite3 编译依赖
RUN apk add --no-cache python3 make g++

WORKDIR /app

# 复制依赖文件
COPY package*.json ./

# 安装所有依赖（包括编译原生模块）
RUN npm install --only=production

# ============ 运行阶段 ============
FROM node:18-alpine

WORKDIR /app

# 只复制必要的运行时文件
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY server ./server
COPY public ./public

# 创建数据目录并设置权限
RUN mkdir -p /app/data /app/uploads && chmod 777 /app/uploads /app/data

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# 启动命令
CMD ["node", "server/index.js"]
