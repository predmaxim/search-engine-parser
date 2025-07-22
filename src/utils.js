const { URL } = require('url');

function buildYandexQuery(topic, location, page = 0) {
  const p = page;
  return `https://yandex.ru/search/?text=${encodeURIComponent(`${topic} ${location}`)}&p=${p}`;
}

function extractDomain(url) {
  try {
    const parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsedUrl.hostname.replace('www.', '');
  } catch (e) {
    console.error(`Error parsing URL: ${url}`);
    return null;
  }
}

function matchesCriteria(domain, snippet, config) {
  const { method, filters } = config.criteria;
  if (config.ignoreDomains && config.ignoreDomains.length > 0 && domain) {
    const domainLower = domain.toLowerCase();
    for (const ignore of config.ignoreDomains) {
      const ignoreLower = ignore.toLowerCase();
      if (domainLower.includes(ignoreLower)) {
        return false;
      }
    }
  }
  if (method === 'AND') {
    return filters.every(filter => {
      if (filter.type === 'domain') {
        return domain.includes(filter.value);
      } else if (filter.type === 'advertisement') {
        return snippet.toLowerCase().includes(filter.value.toLowerCase());
      }
      return false;
    });
  } else {
    return filters.some(filter => {
      if (filter.type === 'domain') {
        return domain.includes(filter.value);
      } else if (filter.type === 'advertisement') {
        return snippet.toLowerCase().includes(filter.value.toLowerCase());
      }
      return false;
    });
  }
}

module.exports = {
  buildYandexQuery,
  extractDomain,
  matchesCriteria
};
