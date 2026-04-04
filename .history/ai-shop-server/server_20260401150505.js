require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const prisma = require('./lib/prisma');

const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = process.env.OPENROUTER_MODEL || 'openrouter/free';
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

function clampProductCount(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 3;
  }

  return Math.min(6, Math.max(1, Math.floor(parsed)));
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function buildPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, passwordHash) {
  const [salt, storedHash] = String(passwordHash || '').split(':');

  if (!salt || !storedHash) {
    return false;
  }

  const calculatedHash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(
    Buffer.from(calculatedHash, 'hex'),
    Buffer.from(storedHash, 'hex'),
  );
}

function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl || '',
  };
}

function toPublicAddress(address) {
  return {
    id: address.id,
    label: address.label,
    recipientName: address.recipientName,
    phone: address.phone,
    address: address.address,
    isDefault: Boolean(address.isDefault),
  };
}

function toPublicPaymentProfile(paymentProfile) {
  return {
    id: paymentProfile.id,
    label: paymentProfile.label,
    method: String(paymentProfile.method || '').toLowerCase(),
    accountName: paymentProfile.accountName,
    accountIdentifier: paymentProfile.accountIdentifier,
    cardLast4: paymentProfile.cardLast4 || '',
    expiry: paymentProfile.expiry || '',
    isDefault: Boolean(paymentProfile.isDefault),
  };
}

function sanitizeText(value) {
  return String(value || '').trim();
}

function normalizeAvatarUrl(value) {
  const trimmed = sanitizeText(value);

  if (!trimmed) {
    return '';
  }

  if (/^data:image\/(?:png|jpeg|jpg|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(trimmed)) {
    return trimmed;
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    return '';
  }

  return trimmed;
}

function buildMaskedCard(cardNumber) {
  const digits = String(cardNumber || '').replace(/\D/g, '');

  if (digits.length < 12) {
    return null;
  }

  const last4 = digits.slice(-4);
  return {
    cardLast4: last4,
    accountIdentifier: `**** **** **** ${last4}`,
  };
}

function toPlainProduct(product) {
  return {
    id: product.id,
    name: product.name,
    price: Number(product.price),
    imageUrl: product.imageUrl,
    category: product.category,
    tags: Array.isArray(product.tags) ? product.tags : [],
    description: product.description || '',
  };
}

function getJsonCandidates(text) {
  const trimmed = String(text || '').trim();
  const candidates = [trimmed];

  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fencedMatch && fencedMatch[1]) {
    candidates.push(fencedMatch[1].trim());
  }

  const firstBraceIndex = trimmed.indexOf('{');
  const lastBraceIndex = trimmed.lastIndexOf('}');
  if (firstBraceIndex !== -1 && lastBraceIndex !== -1 && lastBraceIndex > firstBraceIndex) {
    candidates.push(trimmed.slice(firstBraceIndex, lastBraceIndex + 1).trim());
  }

  return [...new Set(candidates)];
}

function getRecentConversationText(messages) {
  return messages
    .slice(-8)
    .map((message) => `${message.role}: ${message.content}`)
    .join('\n');
}

function getRecentUserIntentText(messages) {
  return messages
    .filter((message) => message.role === 'user')
    .slice(-3)
    .map((message) => message.content)
    .join(' ');
}

function getQueryTokens(query) {
  const normalized = normalizeText(query);
  const tokens = normalized
    .split(/[\s,，。！？!?.、/]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  return [...new Set([normalized, ...tokens])];
}

function scoreProduct(product, query) {
  const normalizedQuery = normalizeText(query);
  const tokens = getQueryTokens(query);
  const name = normalizeText(product.name);
  const category = normalizeText(product.category);
  const description = normalizeText(product.description);
  const tags = product.tags.map((tag) => normalizeText(tag));
  let score = 0;

  if (!normalizedQuery) {
    return 0;
  }

  if (normalizedQuery.includes(name)) {
    score += 10;
  }

  if (normalizedQuery.includes(category)) {
    score += 6;
  }

  for (const tag of tags) {
    if (normalizedQuery.includes(tag)) {
      score += 5;
    }
  }

  for (const token of tokens) {
    if (token.length <= 1) {
      continue;
    }

    if (name.includes(token)) {
      score += 4;
    }

    if (description.includes(token)) {
      score += 2;
    }

    if (tags.some((tag) => tag.includes(token))) {
      score += 4;
    }

    if (category.includes(token)) {
      score += 3;
    }

    if (token === '便宜' || token === '实惠' || token === '划算') {
      if (product.price <= 20) {
        score += 3;
      } else if (product.price <= 100) {
        score += 1;
      }
    }

    if (token === '高端' || token === '旗舰' || token === '高配') {
      if (product.price >= 500) {
        score += 3;
      }
    }
  }

  return score;
}

function hasShoppingIntent(query) {
  const normalized = normalizeText(query);
  const shoppingKeywords = [
    '买',
    '推荐',
    '找',
    '商品',
    '零食',
    '饮料',
    '耳机',
    '鼠标',
    '充电宝',
    '牙膏',
    '水',
    '咖啡',
    '抽纸',
    '纸巾',
    '卷纸',
    '卫生纸',
    '喝的',
    '吃的',
    '想要',
    '来点',
  ];

  return shoppingKeywords.some((keyword) => normalized.includes(keyword));
}

async function getCatalogProducts() {
  const products = await prisma.product.findMany({
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });

  return products.map(toPlainProduct);
}

async function buildCandidateProducts(query, productCount) {
  const products = await getCatalogProducts();
  const scoredProducts = products
    .map((product) => ({
      product,
      score: scoreProduct(product, query),
    }))
    .sort((left, right) => right.score - left.score || left.product.price - right.product.price);

  const positiveMatches = scoredProducts.filter((item) => item.score > 0);
  const limit = Math.min(products.length, Math.max(productCount * 4, 8));

  return {
    candidates: positiveMatches.slice(0, limit).map((item) => item.product),
    hasMatches: positiveMatches.length > 0,
  };
}

function buildSelectionPrompt({ conversationText, candidates, productCount }) {
  return `请根据用户最近对话，从候选商品中选择最适合的 ${productCount} 件商品。

规则：
1. 只能从候选商品中选择，不能编造新商品。
2. 如果用户只是打招呼或闲聊，不要推荐商品，返回聊天回复。
3. 如果用户在购物，必须返回恰好 ${productCount} 个 productIds。
4. productIds 只能来自候选商品的 id 字段。
5. 输出必须是合法 JSON，不能包含 markdown。

返回格式二选一：
聊天：
{"type":"chat","reply":"你的回复"}

推荐：
{"type":"product_selection","reply":"一句简短推荐理由","productIds":["id1","id2"]}

用户最近对话：
${conversationText}

候选商品：
${JSON.stringify(
    candidates.map((product) => ({
      id: product.id,
      name: product.name,
      price: product.price,
      category: product.category,
      tags: product.tags,
      description: product.description,
    })),
    null,
    2,
  )}`;
}

function parseSelectionContent(content) {
  for (const candidate of getJsonCandidates(content)) {
    try {
      const parsed = JSON.parse(candidate);

      if (parsed && parsed.type === 'chat' && typeof parsed.reply === 'string') {
        return {
          type: 'chat',
          reply: parsed.reply.trim(),
        };
      }

      if (
        parsed &&
        parsed.type === 'product_selection' &&
        typeof parsed.reply === 'string' &&
        Array.isArray(parsed.productIds)
      ) {
        return {
          type: 'product_selection',
          reply: parsed.reply.trim(),
          productIds: parsed.productIds.filter((id) => typeof id === 'string'),
        };
      }
    } catch (error) {
      // 忽略单个候选文本解析失败，继续尝试
    }
  }

  return null;
}

function buildOpenRouterStyleResponse(content) {
  return {
    id: `local-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: MODEL,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content,
        },
        finish_reason: 'stop',
      },
    ],
  };
}

async function readResponseBody(response) {
  const rawText = await response.text();

  if (!rawText) {
    return {
      rawText: '',
      data: null,
      parseError: null,
    };
  }

  try {
    return {
      rawText,
      data: JSON.parse(rawText),
      parseError: null,
    };
  } catch (error) {
    return {
      rawText,
      data: null,
      parseError: error,
    };
  }
}

function buildLocalSelectionFallback(candidates, desiredCount, reason) {
  const selectedProducts = candidates.slice(0, desiredCount);

  if (selectedProducts.length === 0) {
    return buildOpenRouterStyleResponse(
      'AI 选品服务暂时不可用，而且本地商品库里也没有匹配商品。',
    );
  }

  return buildOpenRouterStyleResponse(
    JSON.stringify({
      type: 'product_list',
      reply: `AI 选品服务暂时不可用，先按本地规则为你推荐 ${selectedProducts.length} 件商品。原因：${reason}`,
      data: selectedProducts,
    }),
  );
}

function resolveProductsFromIds(productIds, candidates, desiredCount) {
  const candidateMap = new Map(candidates.map((product) => [product.id, product]));
  const selectedProducts = [];

  for (const productId of productIds) {
    const matchedProduct = candidateMap.get(productId);
    if (matchedProduct && !selectedProducts.some((product) => product.id === matchedProduct.id)) {
      selectedProducts.push(matchedProduct);
    }
  }

  if (selectedProducts.length >= desiredCount) {
    return selectedProducts.slice(0, desiredCount);
  }

  for (const product of candidates) {
    if (selectedProducts.length >= desiredCount) {
      break;
    }

    if (!selectedProducts.some((item) => item.id === product.id)) {
      selectedProducts.push(product);
    }
  }

  return selectedProducts.slice(0, desiredCount);
}

async function requestSelectionFromModel({ chatMessages, candidates, productCount }) {
  const conversationText = getRecentConversationText(chatMessages);
  const prompt = buildSelectionPrompt({
    conversationText,
    candidates,
    productCount,
  });

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: '你是一个电商选品助手，只能从候选商品中选择商品，不能虚构商品。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  const { data, rawText, parseError } = await readResponseBody(response);
  return { response, data, rawText, parseError };
}

// 创建token
async function createSession(userId) {
  // 随机生成32个字节并转成16进制字符串
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.session.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  return token;
}

// 得到token
function getBearerToken(authorizationHeader) {
  const header = String(authorizationHeader || '');

  // 如果不是Bearer开头 就认为没有合法token
  if (!header.startsWith('Bearer ')) {
    return '';
  }

  // 把token字符串切出来
  return header.slice('Bearer '.length).trim();
}

async function requireAuth(req, res, next) {
  try {
    const token = getBearerToken(req.headers.authorization);

    if (!token) {
      return res.status(401).json({ error: '缺少登录令牌，请先登录' });
    }

    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      return res.status(401).json({ error: '登录已失效，请重新登录' });
    }

    req.user = toPublicUser(session.user);
    req.authToken = token;
    return next();
  } catch (error) {
    console.error('鉴权中间件异常：', error);
    return res.status(500).json({ error: '鉴权失败，请稍后重试' });
  }
}

async function resolveOrderItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      ok: false,
      error: '订单商品不能为空',
    };
  }

  const normalizedItems = items.map((item) => ({
    productId: String(item?.productId || '').trim(),
    quantity: Number(item?.quantity),
  }));
  const productIds = [...new Set(normalizedItems.map((item) => item.productId).filter(Boolean))];
  const products = await prisma.product.findMany({
    where: {
      id: {
        in: productIds,
      },
    },
  });
  const productMap = new Map(products.map((product) => [product.id, toPlainProduct(product)]));
  const resolvedItems = [];

  for (const item of normalizedItems) {
    const product = productMap.get(item.productId);

    if (!product) {
      return {
        ok: false,
        error: `商品不存在：${item.productId || 'unknown'}`,
      };
    }

    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      return {
        ok: false,
        error: `商品数量不合法：${product.name}`,
      };
    }

    resolvedItems.push({
      productId: product.id,
      name: product.name,
      imageUrl: product.imageUrl,
      price: product.price,
      quantity: item.quantity,
      subtotal: Number((product.price * item.quantity).toFixed(2)),
    });
  }

  return {
    ok: true,
    data: resolvedItems,
  };
}

function buildOrderTotals(items) {
  const subtotal = Number(
    items.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2),
  );
  const shippingFee = subtotal >= 99 || items.length === 0 ? 0 : 12;
  const total = Number((subtotal + shippingFee).toFixed(2));

  return {
    subtotal,
    shippingFee,
    total,
  };
}

function buildOrderId() {
  return `order_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
}

function getPaymentMethodValue(value) {
  switch (String(value || '').toLowerCase()) {
    case 'card':
      return 'CARD';
    case 'alipay':
      return 'ALIPAY';
    case 'wechat':
      return 'WECHAT';
    default:
      return null;
  }
}

async function getAccountSettings(userId) {
  const [user, addresses, paymentProfiles] = await prisma.$transaction([
    prisma.user.findUnique({
      where: { id: userId },
    }),
    prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    }),
    prisma.paymentProfile.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    }),
  ]);

  if (!user) {
    throw new Error('用户不存在');
  }

  return {
    user: toPublicUser(user),
    addresses: addresses.map(toPublicAddress),
    paymentMethods: paymentProfiles.map(toPublicPaymentProfile),
  };
}

function buildAddressPayload(body) {
  const label = sanitizeText(body?.label) || '常用地址';
  const recipientName = sanitizeText(body?.recipientName);
  const phone = sanitizeText(body?.phone);
  const address = sanitizeText(body?.address);

  if (!recipientName || !phone || !address) {
    return {
      ok: false,
      error: '请填写完整的地址信息',
    };
  }

  return {
    ok: true,
    data: {
      label,
      recipientName,
      phone,
      address,
    },
  };
}

function buildPaymentProfilePayload(body, currentProfile = null) {
  const label = sanitizeText(body?.label);
  const accountName = sanitizeText(body?.accountName);
  const paymentMethod = getPaymentMethodValue(body?.method || currentProfile?.method);

  if (!label) {
    return {
      ok: false,
      error: '请填写支付方式备注',
    };
  }

  if (!accountName) {
    return {
      ok: false,
      error: '请填写账户姓名',
    };
  }

  if (!paymentMethod) {
    return {
      ok: false,
      error: '请选择有效的支付方式',
    };
  }

  if (paymentMethod === 'CARD') {
    const maskedCard =
      sanitizeText(body?.cardNumber)
        ? buildMaskedCard(body.cardNumber)
        : currentProfile
          ? {
              cardLast4: currentProfile.cardLast4 || '',
              accountIdentifier: currentProfile.accountIdentifier || '',
            }
          : null;
    const expiry = sanitizeText(body?.expiry || currentProfile?.expiry);

    if (!maskedCard) {
      return {
        ok: false,
        error: '请输入有效的银行卡号',
      };
    }

    if (!expiry) {
      return {
        ok: false,
        error: '请输入银行卡有效期',
      };
    }

    return {
      ok: true,
      data: {
        label,
        method: paymentMethod,
        accountName,
        accountIdentifier: maskedCard.accountIdentifier,
        cardLast4: maskedCard.cardLast4,
        expiry,
      },
    };
  }

  const accountIdentifier = sanitizeText(body?.accountIdentifier || currentProfile?.accountIdentifier);

  if (!accountIdentifier) {
    return {
      ok: false,
      error: '请填写支付账号',
    };
  }

  return {
    ok: true,
    data: {
      label,
      method: paymentMethod,
      accountName,
      accountIdentifier,
      cardLast4: null,
      expiry: null,
    },
  };
}

// 允许前端5173跨域访问后端
app.use(
  cors({
    origin: 'http://localhost:5173',
  }),
);

// 让express自动把json解析成js对象放进req.body
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    return res.json({
      status: 'ok',
      database: 'connected',
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      database: 'disconnected',
    });
  }
});

app.post('/api/products/resolve', async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids)
      ? [...new Set(req.body.ids.map((id) => sanitizeText(id)).filter(Boolean))]
      : [];

    if (ids.length === 0) {
      return res.json({
        products: [],
        missingIds: [],
      });
    }

    const products = await prisma.product.findMany({
      where: {
        id: {
          in: ids,
        },
      },
    });
    const plainProducts = products.map(toPlainProduct);
    const existingIds = new Set(plainProducts.map((product) => product.id));
    const missingIds = ids.filter((id) => !existingIds.has(id));

    return res.json({
      products: plainProducts,
      missingIds,
    });
  } catch (error) {
    console.error('校验商品列表失败：', error);
    return res.status(500).json({ error: '校验商品列表失败，请稍后再试' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');

    if (!email.includes('@')) {
      return res.status(400).json({ error: '请输入有效邮箱地址' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少需要 6 位' });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({ error: '该邮箱已经注册，请直接登录' });
    }

    const user = await prisma.user.create({
      data: {
        name: name || email.split('@')[0],
        email,
        passwordHash: buildPasswordHash(password),
      },
    });

    const token = await createSession(user.id);
    return res.status(201).json({
      user: toPublicUser(user),
      token,
    });
  } catch (error) {
    console.error('用户注册失败：', error);
    return res.status(500).json({ error: '注册失败，请稍后再试' });
  }
});

// 处理登录
app.post('/api/auth/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({ error: '邮箱和密码不能为空' });
    }

    // 去数据库找用户
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // 校验密码
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    // 创建token
    const token = await createSession(user.id);

    // 把这个对象转成json放到响应体里
    return res.json({
      user: toPublicUser(user),
      token,
    });
  } catch (error) {
    console.error('用户登录失败：', error);
    return res.status(500).json({ error: '登录失败，请稍后再试' });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  return res.json({ user: req.user });
});

app.get('/api/account/settings', requireAuth, async (req, res) => {
  try {
    const settings = await getAccountSettings(req.user.id);
    return res.json(settings);
  } catch (error) {
    console.error('获取账户设置失败：', error);
    return res.status(500).json({ error: '获取账户设置失败，请稍后再试' });
  }
});

app.patch('/api/account/profile', requireAuth, async (req, res) => {
  try {
    const name = sanitizeText(req.body?.name);
    const avatarUrl = normalizeAvatarUrl(req.body?.avatarUrl);

    if (!name) {
      return res.status(400).json({ error: '昵称不能为空' });
    }

    if (sanitizeText(req.body?.avatarUrl) && !avatarUrl) {
      return res.status(400).json({ error: '头像必须是本地上传图片或有效的 http/https 图片地址' });
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        name,
        avatarUrl: avatarUrl || null,
      },
    });

    return res.json({
      user: toPublicUser(user),
    });
  } catch (error) {
    console.error('更新账户资料失败：', error);
    return res.status(500).json({ error: '更新账户资料失败，请稍后再试' });
  }
});

app.post('/api/account/addresses', requireAuth, async (req, res) => {
  try {
    const payloadResult = buildAddressPayload(req.body);

    if (!payloadResult.ok) {
      return res.status(400).json({ error: payloadResult.error });
    }

    const requestedDefault = Boolean(req.body?.isDefault);
    const address = await prisma.$transaction(async (tx) => {
      const existingCount = await tx.address.count({
        where: { userId: req.user.id },
      });
      const shouldBeDefault = requestedDefault || existingCount === 0;

      if (shouldBeDefault) {
        await tx.address.updateMany({
          where: { userId: req.user.id },
          data: { isDefault: false },
        });
      }

      return tx.address.create({
        data: {
          userId: req.user.id,
          ...payloadResult.data,
          isDefault: shouldBeDefault,
        },
      });
    });

    return res.status(201).json({
      address: toPublicAddress(address),
    });
  } catch (error) {
    console.error('创建地址失败：', error);
    return res.status(500).json({ error: '创建地址失败，请稍后再试' });
  }
});

app.patch('/api/account/addresses/:addressId', requireAuth, async (req, res) => {
  try {
    const addressId = sanitizeText(req.params.addressId);
    const existingAddress = await prisma.address.findFirst({
      where: {
        id: addressId,
        userId: req.user.id,
      },
    });

    if (!existingAddress) {
      return res.status(404).json({ error: '地址不存在' });
    }

    const payloadResult = buildAddressPayload(req.body);

    if (!payloadResult.ok) {
      return res.status(400).json({ error: payloadResult.error });
    }

    const requestedDefault =
      typeof req.body?.isDefault === 'boolean' ? req.body.isDefault : existingAddress.isDefault;

    const updatedAddress = await prisma.$transaction(async (tx) => {
      let finalIsDefault = requestedDefault;

      if (!requestedDefault && existingAddress.isDefault) {
        const fallbackAddress = await tx.address.findFirst({
          where: {
            userId: req.user.id,
            id: { not: existingAddress.id },
          },
          orderBy: { createdAt: 'asc' },
        });

        if (!fallbackAddress) {
          finalIsDefault = true;
        } else {
          await tx.address.update({
            where: { id: fallbackAddress.id },
            data: { isDefault: true },
          });
        }
      }

      if (finalIsDefault) {
        await tx.address.updateMany({
          where: {
            userId: req.user.id,
            id: { not: existingAddress.id },
          },
          data: { isDefault: false },
        });
      }

      return tx.address.update({
        where: { id: existingAddress.id },
        data: {
          ...payloadResult.data,
          isDefault: finalIsDefault,
        },
      });
    });

    return res.json({
      address: toPublicAddress(updatedAddress),
    });
  } catch (error) {
    console.error('更新地址失败：', error);
    return res.status(500).json({ error: '更新地址失败，请稍后再试' });
  }
});

app.delete('/api/account/addresses/:addressId', requireAuth, async (req, res) => {
  try {
    const addressId = sanitizeText(req.params.addressId);
    const existingAddress = await prisma.address.findFirst({
      where: {
        id: addressId,
        userId: req.user.id,
      },
    });

    if (!existingAddress) {
      return res.status(404).json({ error: '地址不存在' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.address.delete({
        where: { id: existingAddress.id },
      });

      if (existingAddress.isDefault) {
        const fallbackAddress = await tx.address.findFirst({
          where: { userId: req.user.id },
          orderBy: { createdAt: 'asc' },
        });

        if (fallbackAddress) {
          await tx.address.update({
            where: { id: fallbackAddress.id },
            data: { isDefault: true },
          });
        }
      }
    });

    return res.status(204).send();
  } catch (error) {
    console.error('删除地址失败：', error);
    return res.status(500).json({ error: '删除地址失败，请稍后再试' });
  }
});

app.post('/api/account/payment-methods', requireAuth, async (req, res) => {
  try {
    const payloadResult = buildPaymentProfilePayload(req.body);

    if (!payloadResult.ok) {
      return res.status(400).json({ error: payloadResult.error });
    }

    const requestedDefault = Boolean(req.body?.isDefault);
    const paymentMethod = await prisma.$transaction(async (tx) => {
      const existingCount = await tx.paymentProfile.count({
        where: { userId: req.user.id },
      });
      const shouldBeDefault = requestedDefault || existingCount === 0;

      if (shouldBeDefault) {
        await tx.paymentProfile.updateMany({
          where: { userId: req.user.id },
          data: { isDefault: false },
        });
      }

      return tx.paymentProfile.create({
        data: {
          userId: req.user.id,
          ...payloadResult.data,
          isDefault: shouldBeDefault,
        },
      });
    });

    return res.status(201).json({
      paymentMethod: toPublicPaymentProfile(paymentMethod),
    });
  } catch (error) {
    console.error('创建支付方式失败：', error);
    return res.status(500).json({ error: '创建支付方式失败，请稍后再试' });
  }
});

app.patch('/api/account/payment-methods/:paymentMethodId', requireAuth, async (req, res) => {
  try {
    const paymentMethodId = sanitizeText(req.params.paymentMethodId);
    const existingPaymentProfile = await prisma.paymentProfile.findFirst({
      where: {
        id: paymentMethodId,
        userId: req.user.id,
      },
    });

    if (!existingPaymentProfile) {
      return res.status(404).json({ error: '支付方式不存在' });
    }

    const payloadResult = buildPaymentProfilePayload(req.body, existingPaymentProfile);

    if (!payloadResult.ok) {
      return res.status(400).json({ error: payloadResult.error });
    }

    const requestedDefault =
      typeof req.body?.isDefault === 'boolean'
        ? req.body.isDefault
        : existingPaymentProfile.isDefault;

    const updatedPaymentMethod = await prisma.$transaction(async (tx) => {
      let finalIsDefault = requestedDefault;

      if (!requestedDefault && existingPaymentProfile.isDefault) {
        const fallbackPaymentMethod = await tx.paymentProfile.findFirst({
          where: {
            userId: req.user.id,
            id: { not: existingPaymentProfile.id },
          },
          orderBy: { createdAt: 'asc' },
        });

        if (!fallbackPaymentMethod) {
          finalIsDefault = true;
        } else {
          await tx.paymentProfile.update({
            where: { id: fallbackPaymentMethod.id },
            data: { isDefault: true },
          });
        }
      }

      if (finalIsDefault) {
        await tx.paymentProfile.updateMany({
          where: {
            userId: req.user.id,
            id: { not: existingPaymentProfile.id },
          },
          data: { isDefault: false },
        });
      }

      return tx.paymentProfile.update({
        where: { id: existingPaymentProfile.id },
        data: {
          ...payloadResult.data,
          isDefault: finalIsDefault,
        },
      });
    });

    return res.json({
      paymentMethod: toPublicPaymentProfile(updatedPaymentMethod),
    });
  } catch (error) {
    console.error('更新支付方式失败：', error);
    return res.status(500).json({ error: '更新支付方式失败，请稍后再试' });
  }
});

app.delete('/api/account/payment-methods/:paymentMethodId', requireAuth, async (req, res) => {
  try {
    const paymentMethodId = sanitizeText(req.params.paymentMethodId);
    const existingPaymentProfile = await prisma.paymentProfile.findFirst({
      where: {
        id: paymentMethodId,
        userId: req.user.id,
      },
    });

    if (!existingPaymentProfile) {
      return res.status(404).json({ error: '支付方式不存在' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.paymentProfile.delete({
        where: { id: existingPaymentProfile.id },
      });

      if (existingPaymentProfile.isDefault) {
        const fallbackPaymentMethod = await tx.paymentProfile.findFirst({
          where: { userId: req.user.id },
          orderBy: { createdAt: 'asc' },
        });

        if (fallbackPaymentMethod) {
          await tx.paymentProfile.update({
            where: { id: fallbackPaymentMethod.id },
            data: { isDefault: true },
          });
        }
      }
    });

    return res.status(204).send();
  } catch (error) {
    console.error('删除支付方式失败：', error);
    return res.status(500).json({ error: '删除支付方式失败，请稍后再试' });
  }
});

app.post('/api/orders', requireAuth, async (req, res) => {
  try {
    const addressId = sanitizeText(req.body?.addressId);
    const paymentProfileId = sanitizeText(req.body?.paymentProfileId);
    const shipping = req.body?.shipping ?? {};
    const paymentMethod = getPaymentMethodValue(req.body?.paymentMethod);
    const paymentMeta = req.body?.paymentMeta ?? {};
    const resolvedResult = await resolveOrderItems(req.body?.items);

    if (!resolvedResult.ok) {
      return res.status(400).json({ error: resolvedResult.error });
    }

    const orderItems = resolvedResult.data;
    const totals = buildOrderTotals(orderItems);
    const orderId = buildOrderId();
    let shippingName = sanitizeText(shipping.name);
    let shippingPhone = sanitizeText(shipping.phone);
    let shippingAddress = sanitizeText(shipping.address);
    let resolvedPaymentMethod = paymentMethod;
    let cardLast4 = paymentMethod === 'CARD' ? sanitizeText(paymentMeta.cardLast4) || null : null;

    if (addressId) {
      const savedAddress = await prisma.address.findFirst({
        where: {
          id: addressId,
          userId: req.user.id,
        },
      });

      if (!savedAddress) {
        return res.status(400).json({ error: '所选地址不存在，请重新选择' });
      }

      shippingName = savedAddress.recipientName;
      shippingPhone = savedAddress.phone;
      shippingAddress = savedAddress.address;
    }

    if (paymentProfileId) {
      const savedPaymentProfile = await prisma.paymentProfile.findFirst({
        where: {
          id: paymentProfileId,
          userId: req.user.id,
        },
      });

      if (!savedPaymentProfile) {
        return res.status(400).json({ error: '所选支付方式不存在，请重新选择' });
      }

      resolvedPaymentMethod = savedPaymentProfile.method;
      cardLast4 = savedPaymentProfile.cardLast4 || null;
    }

    if (!shippingName || !shippingPhone || !shippingAddress) {
      return res.status(400).json({ error: '收货信息不完整' });
    }

    if (!resolvedPaymentMethod) {
      return res.status(400).json({ error: '支付方式不支持' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.order.create({
        data: {
          id: orderId,
          userId: req.user.id,
          userEmail: req.user.email,
          shippingName,
          shippingPhone,
          shippingAddress,
          paymentMethod: resolvedPaymentMethod,
          paymentGateway: resolvedPaymentMethod === 'CARD' ? 'card-mock' : 'wallet-mock',
          paymentStatus: 'PAID',
          orderStatus: 'PROCESSING',
          cardLast4: resolvedPaymentMethod === 'CARD' ? cardLast4 || null : null,
          subtotal: totals.subtotal,
          shippingFee: totals.shippingFee,
          total: totals.total,
        },
      });

      await tx.orderItem.createMany({
        data: orderItems.map((item) => ({
          orderId,
          productId: item.productId,
          name: item.name,
          imageUrl: item.imageUrl,
          price: item.price,
          quantity: item.quantity,
          subtotal: item.subtotal,
        })),
      });
    });

    return res.status(201).json({
      order: {
        id: orderId,
        createdAt: new Date().toISOString(),
        total: totals.total,
        paymentStatus: 'PAID',
      },
    });
  } catch (error) {
    console.error('创建订单失败：', error);
    return res.status(500).json({ error: '创建订单失败，请稍后再试' });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, productCount } = req.body ?? {};
    const desiredProductCount = clampProductCount(productCount);

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages 必须是非空数组' });
    }

    const chatMessages = messages
      .filter(
        (message) =>
          message &&
          typeof message.content === 'string' &&
          (message.role === 'user' || message.role === 'assistant'),
      )
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

    if (chatMessages.length === 0) {
      return res.status(400).json({ error: '没有可发送给模型的有效消息' });
    }

    const recentUserIntentText = getRecentUserIntentText(chatMessages);
    const { candidates, hasMatches } = await buildCandidateProducts(
      recentUserIntentText,
      desiredProductCount,
    );

    if (!hasMatches && hasShoppingIntent(recentUserIntentText)) {
      return res.json(
        buildOpenRouterStyleResponse(
          '数据库里暂时没有和你需求匹配的商品。现在可试试这些关键词：饮料、零食、耳机、充电宝、鼠标、笔记本、牙膏、抽纸。',
        ),
      );
    }

    if (!process.env.OPENROUTER_API_KEY) {
      if (hasShoppingIntent(recentUserIntentText) && candidates.length > 0) {
        return res.json(
          buildLocalSelectionFallback(
            candidates,
            desiredProductCount,
            '服务器缺少 OPENROUTER_API_KEY 配置',
          ),
        );
      }

      return res.status(500).json({ error: '服务器缺少 OPENROUTER_API_KEY 配置' });
    }

    console.log(`开始 AI 选品，目标商品数：${desiredProductCount}，候选数：${candidates.length}`);

    const { response, data, rawText, parseError } = await requestSelectionFromModel({
      chatMessages,
      candidates,
      productCount: desiredProductCount,
    });

    if (!response.ok) {
      console.error('OpenRouter 选品请求失败：', data);

      if (hasShoppingIntent(recentUserIntentText) && candidates.length > 0) {
        const reason = data?.error?.message || `HTTP ${response.status}`;
        return res.json(buildLocalSelectionFallback(candidates, desiredProductCount, reason));
      }

      return res.status(response.status).json(data || { error: `OpenRouter 请求失败：HTTP ${response.status}` });
    }

    if (parseError) {
      console.error('OpenRouter 返回了非 JSON 内容：', rawText);

      if (hasShoppingIntent(recentUserIntentText) && candidates.length > 0) {
        return res.json(
          buildLocalSelectionFallback(
            candidates,
            desiredProductCount,
            '上游服务返回了不可解析的响应',
          ),
        );
      }

      return res
        .status(502)
        .json({ error: '上游服务返回了不可解析的响应', rawText });
    }

    const modelContent = data?.choices?.[0]?.message?.content;
    const parsedDecision = parseSelectionContent(modelContent);

    if (parsedDecision?.type === 'chat' && !hasShoppingIntent(recentUserIntentText)) {
      return res.json(buildOpenRouterStyleResponse(parsedDecision.reply));
    }

    const fallbackProducts = candidates.slice(0, desiredProductCount);
    const selectedProducts =
      parsedDecision?.type === 'product_selection'
        ? resolveProductsFromIds(parsedDecision.productIds, candidates, desiredProductCount)
        : fallbackProducts;

    if (selectedProducts.length > 0 && (parsedDecision || hasShoppingIntent(recentUserIntentText))) {
      const reply =
        parsedDecision?.type === 'product_selection' && parsedDecision.reply
          ? parsedDecision.reply
          : `我从数据库里帮你挑了 ${selectedProducts.length} 件商品。`;

      return res.json(
        buildOpenRouterStyleResponse(
          JSON.stringify({
            type: 'product_list',
            reply,
            data: selectedProducts,
          }),
        ),
      );
    }

    const fallbackReply =
      parsedDecision?.type === 'chat'
        ? parsedDecision.reply
        : '你好，我可以根据你的需求从数据库里帮你推荐商品。';

    return res.json(buildOpenRouterStyleResponse(fallbackReply));
  } catch (error) {
    console.error('后端服务器内部报错：', error);
    return res.status(500).json({ error: '后端服务器开小差了' });
  }
});

app.listen(PORT, () => {
  console.log('================================');
  console.log('AI Shop Server 已启动');
  console.log(`监听地址：http://localhost:${PORT}`);
  console.log('数据库模式：PostgreSQL + Prisma');
  console.log('================================');
});
