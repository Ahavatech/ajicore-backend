/**
 * Categorization Rule Service
 * Manages vendor pattern → category auto-categorization rules.
 */
const prisma = require('../../lib/prisma');

async function getRules(business_id) {
  return prisma.categorizationRule.findMany({
    where: { business_id },
    orderBy: { match_count: 'desc' },
  });
}

async function getById(id) {
  return prisma.categorizationRule.findUnique({ where: { id } });
}

async function create(data) {
  return prisma.categorizationRule.create({
    data: {
      business_id: data.business_id,
      vendor_pattern: data.vendor_pattern,
      category: data.category,
      auto_apply: data.auto_apply !== undefined ? data.auto_apply : true,
    },
  });
}

async function update(id, data) {
  const updateData = {};
  const fields = ['vendor_pattern', 'category', 'auto_apply'];
  fields.forEach((f) => { if (data[f] !== undefined) updateData[f] = data[f]; });
  return prisma.categorizationRule.update({ where: { id }, data: updateData });
}

async function incrementMatchCount(id) {
  return prisma.categorizationRule.update({
    where: { id },
    data: {
      match_count: { increment: 1 },
      last_applied_at: new Date(),
    },
  });
}

async function remove(id) {
  return prisma.categorizationRule.delete({ where: { id } });
}

async function applyRulesToTransaction(business_id, raw_description) {
  if (!raw_description) return null;
  const rules = await prisma.categorizationRule.findMany({
    where: { business_id, auto_apply: true },
    orderBy: { match_count: 'desc' },
  });

  for (const rule of rules) {
    try {
      const regex = new RegExp(rule.vendor_pattern, 'i');
      if (regex.test(raw_description)) {
        await incrementMatchCount(rule.id);
        return { category: rule.category, rule_id: rule.id, confidence: 0.9 };
      }
    } catch {
      continue;
    }
  }
  return null;
}

module.exports = { getRules, getById, create, update, incrementMatchCount, remove, applyRulesToTransaction };
