const fs = require('fs/promises');
const path = require('path');
const {
  PrismaClient,
  PaymentMethod,
  PaymentStatus,
  OrderStatus,
} = require('@prisma/client');
const productSeeds = require('../data/products');

const prisma = new PrismaClient();
const DATA_DIR = path.join(__dirname, '..', 'data');

async function readJsonArray(filename) {
  try {
    const filePath = path.join(DATA_DIR, filename);
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function mapPaymentMethod(value) {
  switch (String(value || '').toLowerCase()) {
    case 'alipay':
      return PaymentMethod.ALIPAY;
    case 'wechat':
      return PaymentMethod.WECHAT;
    case 'card':
    default:
      return PaymentMethod.CARD;
  }
}

async function seedProducts() {
  for (const product of productSeeds) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: {
        name: product.name,
        price: product.price,
        imageUrl: product.imageUrl,
        category: product.category,
        tags: product.tags,
        description: product.description,
      },
      create: {
        id: product.id,
        name: product.name,
        price: product.price,
        imageUrl: product.imageUrl,
        category: product.category,
        tags: product.tags,
        description: product.description,
      },
    });
  }
}

async function seedUsers() {
  const users = await readJsonArray('users.json');

  for (const user of users) {
    if (!user?.email || !user?.passwordHash) {
      continue;
    }

    await prisma.user.upsert({
      where: { email: String(user.email).toLowerCase() },
      update: {
        name: user.name || String(user.email).split('@')[0],
        passwordHash: user.passwordHash,
      },
      create: {
        id: user.id,
        name: user.name || String(user.email).split('@')[0],
        email: String(user.email).toLowerCase(),
        passwordHash: user.passwordHash,
        createdAt: user.createdAt ? new Date(user.createdAt) : undefined,
      },
    });
  }
}

async function seedSessions() {
  const sessions = await readJsonArray('sessions.json');

  for (const session of sessions) {
    if (!session?.token || !session?.userId) {
      continue;
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true },
    });

    if (!user) {
      continue;
    }

    await prisma.session.upsert({
      where: { token: session.token },
      update: {
        expiresAt: session.expiresAt
          ? new Date(session.expiresAt)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        revokedAt: session.revokedAt ? new Date(session.revokedAt) : null,
      },
      create: {
        token: session.token,
        userId: session.userId,
        createdAt: session.createdAt ? new Date(session.createdAt) : undefined,
        expiresAt: session.expiresAt
          ? new Date(session.expiresAt)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        revokedAt: session.revokedAt ? new Date(session.revokedAt) : null,
      },
    });
  }
}

async function seedOrders() {
  const orders = await readJsonArray('orders.json');

  for (const order of orders) {
    if (!order?.id || !order?.userId || !Array.isArray(order.items)) {
      continue;
    }

    const user = await prisma.user.findUnique({
      where: { id: order.userId },
      select: { id: true, email: true },
    });

    if (!user) {
      continue;
    }

    await prisma.order.upsert({
      where: { id: order.id },
      update: {
        userEmail: order.userEmail || user.email,
        shippingName: order.shipping?.name || '',
        shippingPhone: order.shipping?.phone || '',
        shippingAddress: order.shipping?.address || '',
        paymentMethod: mapPaymentMethod(order.payment?.method),
        paymentGateway: order.payment?.gateway || 'mock',
        paymentStatus:
          order.payment?.status === 'failed'
            ? PaymentStatus.FAILED
            : PaymentStatus.PAID,
        orderStatus: OrderStatus.PAID,
        cardLast4: order.payment?.cardLast4 || null,
        subtotal: order.totals?.subtotal || 0,
        shippingFee: order.totals?.shippingFee || 0,
        total: order.totals?.total || 0,
      },
      create: {
        id: order.id,
        userId: order.userId,
        userEmail: order.userEmail || user.email,
        shippingName: order.shipping?.name || '',
        shippingPhone: order.shipping?.phone || '',
        shippingAddress: order.shipping?.address || '',
        paymentMethod: mapPaymentMethod(order.payment?.method),
        paymentGateway: order.payment?.gateway || 'mock',
        paymentStatus:
          order.payment?.status === 'failed'
            ? PaymentStatus.FAILED
            : PaymentStatus.PAID,
        orderStatus: OrderStatus.PAID,
        cardLast4: order.payment?.cardLast4 || null,
        subtotal: order.totals?.subtotal || 0,
        shippingFee: order.totals?.shippingFee || 0,
        total: order.totals?.total || 0,
        createdAt: order.createdAt ? new Date(order.createdAt) : undefined,
      },
    });

    await prisma.orderItem.deleteMany({
      where: { orderId: order.id },
    });

    if (order.items.length > 0) {
      await prisma.orderItem.createMany({
        data: order.items
          .filter((item) => item?.productId)
          .map((item) => ({
            orderId: order.id,
            productId: item.productId,
            name: item.name || '',
            imageUrl: item.imageUrl || '',
            price: item.price || 0,
            quantity: item.quantity || 1,
            subtotal: item.subtotal || Number((item.price || 0) * (item.quantity || 1)),
            createdAt: order.createdAt ? new Date(order.createdAt) : undefined,
          })),
      });
    }
  }
}

async function main() {
  await seedProducts();
  await seedUsers();
  await seedSessions();
  await seedOrders();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('Prisma seed 失败：', error);
    await prisma.$disconnect();
    process.exit(1);
  });
