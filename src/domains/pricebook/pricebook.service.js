/**
 * Price Book Service
 * Manages service categories and price book items.
 */
const prisma = require('../../lib/prisma');

// ---- Service Categories ----

async function getCategories(businessId) {
  return prisma.serviceCategory.findMany({
    where: { business_id: businessId, is_active: true },
    include: { _count: { select: { price_book_items: true } } },
    orderBy: { name: 'asc' },
  });
}

async function createCategory(data) {
  return prisma.serviceCategory.create({
    data: {
      business_id: data.business_id,
      name: data.name,
      custom_description: data.custom_description || null,
    },
  });
}

async function updateCategory(id, data) {
  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.custom_description !== undefined) updateData.custom_description = data.custom_description;
  if (data.is_active !== undefined) updateData.is_active = data.is_active;
  return prisma.serviceCategory.update({ where: { id }, data: updateData });
}

async function deleteCategory(id) {
  return prisma.serviceCategory.update({ where: { id }, data: { is_active: false } });
}

// ---- Price Book Items ----

async function getPriceBookItems({ business_id, category_id, search, can_quote_phone, page = 1, limit = 50 }) {
  const where = { business_id, is_active: true };
  if (category_id) where.category_id = category_id;
  if (can_quote_phone !== undefined) where.can_quote_phone = can_quote_phone === 'true';
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    prisma.priceBookItem.findMany({
      where,
      skip,
      take: limit,
      include: { category: true },
      orderBy: { name: 'asc' },
    }),
    prisma.priceBookItem.count({ where }),
  ]);

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

async function getPriceBookItemById(id) {
  return prisma.priceBookItem.findUnique({
    where: { id },
    include: { category: true },
  });
}

async function createPriceBookItem(data) {
  return prisma.priceBookItem.create({
    data: {
      business_id: data.business_id,
      category_id: data.category_id || null,
      name: data.name,
      description: data.description || null,
      can_quote_phone: data.can_quote_phone ?? false,
      price_type: data.price_type || 'NeedsOnsite',
      price: data.price ?? null,
      price_min: data.price_min ?? null,
      price_max: data.price_max ?? null,
      visit_type: data.visit_type || 'FreeEstimate',
      service_call_fee: data.service_call_fee ?? null,
      suggested_materials: data.suggested_materials || null,
    },
    include: { category: true },
  });
}

async function updatePriceBookItem(id, data) {
  const updateData = {};
  const fields = ['name', 'description', 'can_quote_phone', 'price_type', 'price', 'price_min',
    'price_max', 'visit_type', 'service_call_fee', 'suggested_materials', 'category_id', 'is_active'];
  fields.forEach((f) => { if (data[f] !== undefined) updateData[f] = data[f]; });
  return prisma.priceBookItem.update({ where: { id }, data: updateData, include: { category: true } });
}

async function incrementUsage(id) {
  return prisma.priceBookItem.update({
    where: { id },
    data: { usage_count: { increment: 1 } },
  });
}

async function deletePriceBookItem(id) {
  return prisma.priceBookItem.update({ where: { id }, data: { is_active: false } });
}

/**
 * Lookup price book item for AI call flow.
 * Returns pricing info for a given service name.
 */
async function lookupForAI(businessId, options = {}) {
  const {
    query,
    category_id,
    can_quote_phone,
    limit = 20,
  } = typeof options === 'string' ? { query: options } : options;

  const where = {
    business_id: businessId,
    is_active: true,
  };

  if (category_id) where.category_id = category_id;
  if (can_quote_phone !== undefined) where.can_quote_phone = can_quote_phone === true || can_quote_phone === 'true';
  if (query) {
    where.OR = [
      { name: { contains: query, mode: 'insensitive' } },
      { description: { contains: query, mode: 'insensitive' } },
    ];
  }

  return prisma.priceBookItem.findMany({
    where,
    take: Math.min(100, Math.max(1, parseInt(limit, 10) || 20)),
    include: { category: true },
    orderBy: { usage_count: 'desc' },
  });
}

/**
 * Get suggested items for auto-add (used after repeated bookings).
 * Returns services booked 3+ times that are not in the price book.
 */
async function getSuggestedItems(businessId) {
  const jobs = await prisma.job.groupBy({
    by: ['title'],
    where: { business_id: businessId, title: { not: null } },
    _count: { title: true },
    having: { title: { _count: { gte: 3 } } },
    orderBy: { _count: { title: 'desc' } },
  });

  const existingNames = (await prisma.priceBookItem.findMany({
    where: { business_id: businessId, is_active: true },
    select: { name: true },
  })).map((i) => i.name.toLowerCase());

  return jobs
    .filter((j) => j.title && !existingNames.includes(j.title.toLowerCase()))
    .map((j) => ({
      title: j.title,
      booking_count: j._count.title,
      suggestion: `You've done "${j.title}" ${j._count.title} times. Add to price book?`,
    }));
}

module.exports = {
  getCategories, createCategory, updateCategory, deleteCategory,
  getPriceBookItems, getPriceBookItemById, createPriceBookItem,
  updatePriceBookItem, incrementUsage, deletePriceBookItem,
  lookupForAI, getSuggestedItems,
};
