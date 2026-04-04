/* 
    导出一个可复用的Prisma实例
*/

// 从npm包里拿
const { PrismaClient } = require('@prisma/client');

const globalForPrisma = globalThis; //整个 Node.js 进程共享的总空间。

const prisma =
  // 如果全局对象里已经有一个prisma实例 就直接复用它 
  globalForPrisma.__aiShopPrisma ||
  // 创建数据库客户端实例
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__aiShopPrisma = prisma;
}

module.exports = prisma;
