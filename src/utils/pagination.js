function buildPageLinks(req, { page, limit, pages }) {
  const url = new URL(`${req.protocol}://${req.get('host')}${req.originalUrl}`);
  const make = (targetPage) => {
    if (pages === 0 || targetPage < 1 || targetPage > pages) return null;
    url.searchParams.set('page', String(targetPage));
    url.searchParams.set('limit', String(limit));
    return `${url.pathname}?${url.searchParams.toString()}`;
  };
  return {
    self: pages === 0 ? `${url.pathname}?${new URLSearchParams({ ...Object.fromEntries(url.searchParams), page: String(page), limit: String(limit) }).toString()}` : make(page) || `${url.pathname}?${url.searchParams.toString()}`,
    next: make(page + 1),
    previous: make(page - 1)
  };
}

function paginated({ data, total, page, limit, links }) {
  const pages = total === 0 ? 0 : Math.ceil(total / limit);
  return {
    data,
    meta: { total, page, limit, pages },
    links
  };
}

module.exports = { buildPageLinks, paginated };
