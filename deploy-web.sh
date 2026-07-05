#!/bin/bash
set -e

echo "🚀 YEZZ 前端部署到 Vercel"
echo "=========================="

# 检查是否在正确目录
if [ ! -f "package.json" ] || [ ! -d "apps/web" ]; then
    echo "❌ 请在项目根目录运行此脚本"
    exit 1
fi

# 检查 vercel CLI
if ! command -v vercel &> /dev/null; then
    echo "❌ vercel CLI 未安装"
    echo "安装: npm install -g vercel"
    exit 1
fi

# 检查是否登录
if ! vercel whoami &> /dev/null; then
    echo "❌ 请先登录 Vercel"
    echo "运行: vercel login"
    exit 1
fi

# 设置环境变量（构建时注入）
export NEXT_PUBLIC_API_URL="https://yezz-api.fly.dev"
export NEXT_PUBLIC_USE_API="true"
export NEXT_PUBLIC_MEDIA_URL="https://yezz-api.fly.dev/media"

echo ""
echo "📋 构建变量:"
echo "  NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL"
echo "  NEXT_PUBLIC_USE_API=$NEXT_PUBLIC_USE_API"
echo ""

echo "🌐 前端域名: yezyy.com"
echo "🔗 API 地址: yezz-api.fly.dev"
echo ""

echo "⚠️  请确保 Fly.io CORS 已设置:"
echo "   fly secrets set CORS_ORIGIN=\"https://yezyy.com\""
echo ""

if [ "$1" = "--prod" ] || [ "$1" = "-p" ]; then
    echo "🚀 部署到生产环境..."
    vercel --cwd apps/web --prod
else
    echo "🚀 部署到预览环境..."
    echo "（添加 --prod 参数可部署到生产环境）"
    vercel --cwd apps/web
fi

echo ""
echo "✅ 前端部署完成！"
echo ""
echo "📝 下一步:"
echo "1. 在 Vercel Dashboard → Domains 绑定: yezyy.com"
echo "2. 域名 DNS 添加 CNAME: yezyy.com → cname.vercel-dns.com"
echo "3. 确认 Fly.io CORS 已设置:"
echo "   fly secrets set CORS_ORIGIN=\"https://yezyy.com\""