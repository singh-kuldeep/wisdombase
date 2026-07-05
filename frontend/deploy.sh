#!/bin/bash

# WisdomBase Web Deployment Script
# This script builds and deploys the web app to wisdombase.expo.app

set -e

echo "🚀 Starting WisdomBase deployment..."
echo ""

# Build web export
echo "📦 Building web export..."
npx expo export --platform web

echo ""
echo "✅ Web build complete!"
echo ""

# Deploy to Vercel
echo "🌐 Deploying to Vercel..."
vercel --prod

echo ""
echo "✨ Deployment complete!"
echo "🔗 Your app is live at: https://wisdombase.expo.app/"
