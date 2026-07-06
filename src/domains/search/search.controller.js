/**
 * Search Controller
 * Handles global search/omnibar requests.
 */
const searchService = require('./search.service');

async function globalSearch(req, res, next) {
  try {
    const { business_id, q, limit = 5 } = req.query;
    
    if (!q || q.length < 1) {
      return res.json({
        results: {
          customers: [],
          jobs: [],
          invoices: [],
          quotes: [],
          fleet: [],
        },
      });
    }

    const result = await searchService.globalSearch({
      business_id,
      q,
      limit: Math.min(parseInt(limit), 10),
    });
    
    res.json(result);
  } catch (err) { next(err); }
}

module.exports = { globalSearch };
