/**
 * Price Book Service
 * Manages service categories and price book items.
 */
const prisma = require('../../lib/prisma');
const { roundMoney, toNumber } = require('../../utils/financial_calculator');

const DEFAULT_MARKUP_PERCENT = 49;

function sumItems(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => {
    if (item.price !== undefined) return sum + toNumber(item.price);
    return sum + (toNumber(item.qty, 1) * toNumber(item.rate));
  }, 0);
}

async function getMarkupPercent(businessId) {
  const settings = await prisma.businessFinanceSettings.findUnique({
    where: { business_id: businessId },
    select: { markup_percent: true },
  }).catch(() => null);

  return toNumber(settings?.markup_percent, DEFAULT_MARKUP_PERCENT);
}

function calculateUnitEconomics(data, markupPercent) {
  const materials = Array.isArray(data.materials) ? data.materials : null;
  const tools = Array.isArray(data.tools) ? data.tools : null;
  const totalMaterialsCost = data.total_materials_cost !== undefined
    ? toNumber(data.total_materials_cost)
    : sumItems(materials);
  const totalToolsCost = data.total_tools_cost !== undefined
    ? toNumber(data.total_tools_cost)
    : sumItems(tools);
  const laborCost = data.labor_cost !== undefined ? toNumber(data.labor_cost) : null;
  const baseCost = data.base_cost !== undefined
    ? toNumber(data.base_cost)
    : toNumber(laborCost) + totalMaterialsCost + totalToolsCost;
  const flatRate = roundMoney(baseCost * (1 + (markupPercent / 100)));
  const marginAmount = roundMoney(flatRate - baseCost);
  const marginPercent = flatRate > 0 ? Math.round((marginAmount / flatRate) * 100) : 0;

  return {
    materials,
    tools,
    labor_cost: laborCost,
    total_materials_cost: roundMoney(totalMaterialsCost),
    total_tools_cost: roundMoney(totalToolsCost),
    base_cost: roundMoney(baseCost),
    flat_rate: flatRate,
    margin_amount: marginAmount,
    margin_percent: marginPercent,
  };
}

function mapPriceBookItem(item) {
  if (!item) return item;
  return {
    ...item,
    notes: item.notes || item.description || null,
    category_name: item.category?.name || null,
  };
}

async function resolveCategoryId(data) {
  if (!data.custom_category_name) return data.category_id || null;

  const existing = await prisma.serviceCategory.findFirst({
    where: {
      business_id: data.business_id,
      name: { equals: data.custom_category_name, mode: 'insensitive' },
    },
  });
  if (existing) return existing.id;

  const category = await prisma.serviceCategory.create({
    data: {
      business_id: data.business_id,
      name: data.custom_category_name,
    },
  });
  return category.id;
}

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

  return { data: data.map(mapPriceBookItem), total, page, limit, totalPages: Math.ceil(total / limit) };
}

async function getPriceBookItemById(id) {
  const item = await prisma.priceBookItem.findUnique({
    where: { id },
    include: { category: true },
  });
  return mapPriceBookItem(item);
}

async function createPriceBookItem(data) {
  const categoryId = await resolveCategoryId(data);
  const markupPercent = await getMarkupPercent(data.business_id);
  const economics = calculateUnitEconomics(data, markupPercent);

  const item = await prisma.priceBookItem.create({
    data: {
      business_id: data.business_id,
      category_id: categoryId,
      name: data.name,
      description: data.description || data.notes || null,
      notes: data.notes || data.description || null,
      can_quote_phone: data.can_quote_phone ?? false,
      price_type: data.price_type || 'NeedsOnsite',
      price: data.price ?? economics.flat_rate ?? null,
      price_min: data.price_min ?? null,
      price_max: data.price_max ?? null,
      visit_type: data.visit_type || 'FreeEstimate',
      service_call_fee: data.service_call_fee ?? null,
      labor_time: data.labor_time || null,
      labor_cost: economics.labor_cost,
      materials: economics.materials,
      tools: economics.tools,
      total_materials_cost: economics.total_materials_cost,
      total_tools_cost: economics.total_tools_cost,
      base_cost: economics.base_cost,
      flat_rate: economics.flat_rate,
      margin_amount: economics.margin_amount,
      margin_percent: economics.margin_percent,
      suggested_materials: data.suggested_materials || null,
    },
    include: { category: true },
  });

  return mapPriceBookItem(item);
}

async function updatePriceBookItem(id, data) {
  const updateData = {};
  const fields = ['name', 'description', 'can_quote_phone', 'price_type', 'price', 'price_min',
    'price_max', 'visit_type', 'service_call_fee', 'suggested_materials', 'category_id', 'is_active',
    'notes', 'labor_time'];
  fields.forEach((f) => { if (data[f] !== undefined) updateData[f] = data[f]; });

  if (data.custom_category_name) {
    const current = await prisma.priceBookItem.findUnique({ where: { id }, select: { business_id: true } });
    updateData.category_id = await resolveCategoryId({ ...data, business_id: current.business_id });
  }

  const economicsFields = ['labor_cost', 'materials', 'tools', 'total_materials_cost', 'total_tools_cost', 'base_cost'];
  if (economicsFields.some((field) => data[field] !== undefined)) {
    const current = await prisma.priceBookItem.findUnique({ where: { id }, select: { business_id: true } });
    const markupPercent = await getMarkupPercent(current.business_id);
    Object.assign(updateData, calculateUnitEconomics(data, markupPercent));
    updateData.price = updateData.flat_rate;
  }

  const item = await prisma.priceBookItem.update({ where: { id }, data: updateData, include: { category: true } });
  return mapPriceBookItem(item);
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
