#!/bin/bash
set -e

# ============================================
# YEZZ 生产环境部署脚本
# 用法: ./deploy.sh
# ============================================

echo "🚀 YEZZ 生产环境部署"
echo "===================="

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose 未安装，请先安装"
    exit 1
fi

# 检查 .env 文件
if [ ! -f .env ]; then
    echo "❌ 未找到 .env 文件"
    echo "请复制 .env.production 为 .env 并修改配置："
    echo "  cp .env.production .env"
    echo "  nano .env"
    exit 1
fi

# 加载环境变量
export $(grep -v '^#' .env | xargs)

# 检查必要变量
if [ -z "$DOMAIN" ] || [ "$DOMAIN" = "your-domain.com" ]; then
    echo "❌ 请先在 .env 中设置 DOMAIN（你的域名）"
    exit 1
fi

if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "your_very_long_random_secret_key_here" ]; then
    echo "❌ 请先在 .env 中设置 JWT_SECRET"
    exit 1
fi

echo ""
echo "📋 部署配置:"
echo "  域名: $DOMAIN"
echo ""

# 构建并启动
echo "🔨 构建并启动服务..."

# 第一次部署：先执行迁移和 seed
if [ "$1" = "--init" ]; then
    echo "📦 首次部署：执行数据库迁移和种子..."
    docker compose -f docker-compose.prod.yml --profile setup up --build migrate seed
fi

# 启动所有服务
docker compose -f docker-compose.prod.yml up -d --build

echo ""
echo "✅ 部署完成！"
echo ""
echo "🌐 访问地址:"
echo "  网站: https://$DOMAIN"
echo "  管理后台: https://$DOMAIN/admin"
echo ""
echo "📊 查看状态:"
echo "  docker compose -f docker-compose.prod.yml ps"
echo ""
echo "📜 查看日志:"
echo "  docker compose -f docker-compose.prod.yml logs -f"
echo ""
echo "🔄 以后更新代码后执行:"
echo "  ./deploy.sh"