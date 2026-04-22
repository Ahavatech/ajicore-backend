/**
 * Search Service
 * Business logic for global/omnibar search across multiple entities.
 */
const prisma = require('../../lib/prisma');

function sanitizeSearchInput(input, maxLength = 100) {
  if (!input) return null;
  let sanitized = String(input).trim().substring(0, maxLength);
  sanitized = sanitized.replace(/[.*+?^${}()|[\]\\]/g, '');
  if (sanitized.match(/[\x00-\x1f\x7f]/)) {
    return null;
  }
  return sanitized;
}

async function globalSearch({ business_id, q, limit = 5 }) {
  const cleanSearch = sanitizeSearchInput(q);
  if (!cleanSearch) {
    return {
      results: {
        customers: [],
        jobs: [],
        invoices: [],
        quotes: [],
        fleet: [],
      },
    };
  }

  

  const [customers, jobs, invoices, quotes, fleet] = await Promise.all([
    // Search customers by name or email
        prisma.customer.findMany({
      where: {
        business_id,
        OR: [
          { first_name: { contains: cleanSearch, mode: 'insensitive' } },
          { last_name: { contains: cleanSearch, mode: 'insensitive' } },
          { company_name: { contains: cleanSearch, mode: 'insensitive' } },
          { email: { contains: cleanSearch, mode: 'insensitive' } },
          { phone_number: { contains: cleanSearch } },
        ],
      },
      select: { id: true, first_name: true, last_name: true, email: true, phone_number: true, company_name: true, customer_type: true },
      take: limit,
    }),
    // Search jobs by title or details
    prisma.job.findMany({
      where: {
        business_id,
        OR: [
          { title: { contains: cleanSearch, mode: 'insensitive' } },
          { job_details: { contains: cleanSearch, mode: 'insensitive' } },
          { address: { contains: cleanSearch, mode: 'insensitive' } },
        ],
      },
      select: { id: true, title: true, scheduled_start_time: true, status: true },
      take: limit,
    }),
    // Search invoices by number/id or customer name (via join)
        (() => {
      const invoiceToken = String(cleanSearch).replace(/^INV-/i, '').trim();

      return prisma.invoice.findMany({
        where: {
          job: { business_id },
          OR: [
            { id: { contains: invoiceToken, mode: 'insensitive' } },
            {
              job: {
                customer: {
                  OR: [
                    { first_name: { contains: cleanSearch, mode: 'insensitive' } },
                    { last_name: { contains: cleanSearch, mode: 'insensitive' } },
                  ],
                },
              },
            },
          ],
        },
        select: {
          id: true,
          status: true,
          line_items: { select: { total: true } },
          job: { select: { customer: { select: { first_name: true, last_name: true } } } },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      });
    })(),
    // Search quotes by title or customer name
    prisma.quote.findMany({
      where: {
        business_id,
        OR: [
          { title: { contains: cleanSearch, mode: 'insensitive' } },
          { description: { contains: cleanSearch, mode: 'insensitive' } },
          { customer: { OR: [
            { first_name: { contains: cleanSearch, mode: 'insensitive' } },
            { last_name: { contains: cleanSearch, mode: 'insensitive' } },
          ] } },
        ],
      },
      include: { customer: { select: { first_name: true, last_name: true } } },
      take: limit,
    }),
    // Search vehicles by make/model or license plate
    prisma.vehicle.findMany({
      where: {
        business_id,
        OR: [
          { make_model: { contains: cleanSearch, mode: 'insensitive' } },
          { license_plate: { contains: cleanSearch, mode: 'insensitive' } },
          { vin: { contains: cleanSearch, mode: 'insensitive' } },
        ],
      },
      select: { id: true, make_model: true, license_plate: true },
      take: limit,
    }),
  ]);

    const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const formatMoney = (amount) => currency.format(Number(amount || 0));

  const invoiceStatusLabel = (status) => {
    // Keep labels simple for omnibar subtitle.
    if (!status) return 'Unknown';
    if (status === 'Paid') return 'Paid';
    if (status === 'Overdue') return 'Overdue';
    return 'Unpaid';
  };

  // Format results to generic schema
  return {
    results: {
      customers: customers.map((c) => {
        const fullName = `${c.first_name || ''} ${c.last_name || ''}`.trim();
        const title = (c.customer_type === 'Company' && c.company_name)
          ? c.company_name
          : (fullName || c.company_name || 'Unknown');

        return {
          id: c.id,
          title,
          subtitle: c.email || c.phone_number || '',
          type: 'customer',
        };
      }),
      jobs: jobs.map((j) => ({
        id: j.id,
        title: j.title || 'Untitled Job',
        subtitle: j.scheduled_start_time
          ? `Scheduled for ${new Date(j.scheduled_start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
          : (j.status || ''),
        type: 'job',
      })),
      invoices: invoices.map((inv) => {
        const total = (inv.line_items || []).reduce((sum, li) => sum + (li.total || 0), 0);
        return {
          id: inv.id,
          title: `INV-${inv.id.substring(0, 8).toUpperCase()}`,
          subtitle: `${formatMoney(total)} - ${invoiceStatusLabel(inv.status)}`,
          type: 'invoice',
        };
      }),
      quotes: quotes.map((q) => ({
        id: q.id,
        title: q.title || 'Untitled Quote',
        subtitle: q.customer ? `${q.customer.first_name} ${q.customer.last_name}` : '',
        type: 'quote',
      })),
      fleet: fleet.map((v) => ({
        id: v.id,
        title: v.make_model || 'Vehicle',
        subtitle: v.license_plate || '',
        type: 'vehicle',
      })),
    },
  };
}


module.exports = { globalSearch };
