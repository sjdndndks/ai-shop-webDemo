const { PrismaClient } = require('@prisma/client');

const globalForPrisma = globalThis; //整个 Node.js 进程共享的总空间。

const prisma =
  globalForPrisma.__aiShopPrisma ||
  // 创建数据库客户端实例
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__aiShopPrisma = prisma;
}

module.exports = prisma;
