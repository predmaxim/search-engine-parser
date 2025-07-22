

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { buildYandexQuery, extractDomain, matchesCriteria } = require('./utils');

const config = {
  topic: "мебель",
  location: "Бузулук",
  criteria: {
    method: 'OR',
    filters: [
      { type: 'advertisement', value: 'бузулук' }
    ]
  },
  ignoreDomains: [
    "skolkomebeli.ru", "avito.ru", "yandex.ru", "google.ru",
    "market.yandex.ru", "wildberries.ru", "ozon.ru", "aliexpress.ru"
  ],
  pages: 3,
  delay: 5000,
  yandexCookiesPath: 'ya.ru_cookies.json'
};



async function parseYandexResults(config) {
  const results = new Set();
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  });
  const pageObj = await browser.newPage();
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.1 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:90.0) Gecko/20100101 Firefox/90.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'
  ];
  const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
  await pageObj.setUserAgent(randomUA);
  if (config.yandexCookiesPath && fs.existsSync(config.yandexCookiesPath)) {
    try {
      const cookies = JSON.parse(fs.readFileSync(config.yandexCookiesPath, 'utf8'));
      await pageObj.setCookie(...cookies);
    } catch (e) { }
  }
  for (let page = 0; page < config.pages; page++) {
    const url = buildYandexQuery(config.topic, config.location, page);
    process.stdout.write(`\rПарсинг страницы ${page + 1} из ${config.pages}   `);
    try {
      await pageObj.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await pageObj.setGeolocation({ latitude: 52.7881, longitude: 52.2634 });
      await pageObj.setCookie({ name: 'yandex_gid', value: '11086', domain: '.yandex.ru' });
      await pageObj.mouse.move(100, 100);
      await pageObj.mouse.move(200, 200);
      await pageObj.mouse.move(300, 150);
      await pageObj.mouse.move(400, 250);
      await pageObj.mouse.move(500, 100);
      await pageObj.evaluate(() => { window.scrollBy(0, 500); });
      await new Promise(resolve => setTimeout(resolve, 1500));
      await pageObj.evaluate(() => { window.scrollBy(0, 1000); });
      await new Promise(resolve => setTimeout(resolve, 1500));
      const html = await pageObj.content();
      if (page === 0) {
        fs.writeFileSync('yandex_debug.html', html, 'utf8');
      }
      const items = await pageObj.$$eval('li.serp-item', nodes => nodes.map(el => {
        const a = el.querySelector('a[href^="http"]');
        let snippet = '';
        const snip = el.querySelector('.TextContainer, .organic__content-text, .serp-item__text, .text-container');
        if (snip) snippet = snip.innerText;
        return { link: a ? a.href : null, snippet };
      }));
      for (let i = 0; i < items.length; i++) {
        const { link, snippet } = items[i];
        if (link) {
          const domain = extractDomain(link);
          if (domain && matchesCriteria(domain, snippet, config)) {
            results.add(link.split('?')[0]);
          }
        }
      }
      await new Promise(resolve => setTimeout(resolve, config.delay));
    } catch (error) { }
  }
  process.stdout.write('\n');
  await browser.close();
  if (results.size === 0) {
    console.warn('\nНе найдено ни одного результата. Проверьте структуру HTML или наличие блокировки.');
  }
  return Array.from(results);
}



async function main(config) {
  try {
    const yandexResults = await parseYandexResults(config);
    const uniqueYandex = [...new Set(yandexResults)];
    console.log(`\nНайдено уникальных сайтов (Яндекс): ${uniqueYandex.length}`);
    if (uniqueYandex.length > 0) {
      const now = new Date();
      const pad = n => n.toString().padStart(2, '0');
      const fileName = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}-${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}-yandex.txt`;
      const filePath = path.join(__dirname, fileName);
      let fileContent = 'Yandex:\n';
      fileContent += uniqueYandex.map((url, i) => `${i + 1}. ${url}`).join('\n') + '\n';
      fs.writeFileSync(filePath, fileContent, 'utf8');
      console.log(`Результаты сохранены в файл: ${fileName}`);
    }
    return uniqueYandex;
  } catch (error) {
    console.error('Ошибка при парсинге:', error.message);
    if (error.stack) console.error(error.stack);
    return [];
  }
}

main(config);