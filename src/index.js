
const puppeteer = require('puppeteer');
const { URL } = require('url');

// Конфигурация поиска только для Яндекса
const config = {
  topic: "мебель",
  location: "Бузулук",
  criteria: {
    method: 'OR',
    filters: [
      { type: 'advertisement', value: 'бузулук' },
    ]
  },
  ignoreDomains: ["skolkomebeli.ru", "avito.ru", "yandex.ru", "google.ru", "market.yandex.ru", "wildberries.ru", "ozon.ru", "aliexpress.ru"],
  pages: 3,
  delay: 5000,
  yandexCookiesPath: 'ya.ru_cookies.json'
};



// Функция для создания поискового запроса в Яндекс
function buildYandexQuery(topic, location, page = 0) {
  const p = page;
  return `https://yandex.ru/search/?text=${encodeURIComponent(`${topic} ${location}`)}&p=${p}`;
}

// Функция для извлечения доменов из URL
function extractDomain(url) {
  try {
    const parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsedUrl.hostname.replace('www.', '');
  } catch (e) {
    console.error(`Error parsing URL: ${url}`);
    return null;
  }
}

// Функция для проверки соответствия критериям
function matchesCriteria(domain, snippet, config) {
  const { method, filters } = config.criteria;
  // Проверка: если в домене есть вхождение любого значения из ignoreDomains
  if (config.ignoreDomains && config.ignoreDomains.length > 0 && domain) {
    const domainLower = domain.toLowerCase();
    for (const ignore of config.ignoreDomains) {
      const ignoreLower = ignore.toLowerCase();
      if (domainLower.includes(ignoreLower)) {
        console.log(`[Фильтр] Игнор-домен: ${domain} содержит '${ignore}'`);
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
  } else { // OR
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



// Функция для парсинга результатов Яндекс
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
  // Случайный User-Agent
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.1 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:90.0) Gecko/20100101 Firefox/90.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'
  ];
  const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
  await pageObj.setUserAgent(randomUA);
  // Загружаем cookies для Яндекс, если есть
  const fs = require('fs');
  if (config.yandexCookiesPath && fs.existsSync(config.yandexCookiesPath)) {
    try {
      const cookies = JSON.parse(fs.readFileSync(config.yandexCookiesPath, 'utf8'));
      await pageObj.setCookie(...cookies);
      console.log(`[Yandex] Куки загружены из ${config.yandexCookiesPath}`);
    } catch (e) {
      console.warn(`[Yandex] Ошибка загрузки cookies (${config.yandexCookiesPath}):`, e.message);
    }
  }

  for (let page = 0; page < config.pages; page++) {
    const url = buildYandexQuery(config.topic, config.location, page);
    console.log(`[Yandex] Страница ${page + 1}, URL: ${url}`);
    try {
      await pageObj.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      // Установка cookie и геолокации после перехода на страницу
      await pageObj.setGeolocation({ latitude: 52.7881, longitude: 52.2634 });
      await pageObj.setCookie({ name: 'yandex_gid', value: '11086', domain: '.yandex.ru' });
      // Эмуляция движения мыши и скроллинга
      await pageObj.mouse.move(100, 100);
      await pageObj.mouse.move(200, 200);
      await pageObj.mouse.move(300, 150);
      await pageObj.mouse.move(400, 250);
      await pageObj.mouse.move(500, 100);
      await pageObj.evaluate(() => {
        window.scrollBy(0, 500);
      });
      await new Promise(resolve => setTimeout(resolve, 1500));
      await pageObj.evaluate(() => {
        window.scrollBy(0, 1000);
      });
      await new Promise(resolve => setTimeout(resolve, 1500));
      // Диагностика: выводим часть HTML
      const html = await pageObj.content();
      console.log(`[Yandex] HTML (первые 500 символов):\n${html.substring(0, 500)}`);
      // Сохраняем полный HTML для первой страницы
      if (page === 0) {
        const fs = require('fs');
        fs.writeFileSync('yandex_debug.html', html, 'utf8');
        console.log('[Yandex] Полный HTML сохранен в yandex_debug.html');
      }
      // Новый селектор для Яндекса: ищем все .serp-item a[href^="http"]
      const items = await pageObj.$$eval('li.serp-item', nodes => nodes.map(el => {
        const a = el.querySelector('a[href^="http"]');
        // Сниппет: ищем .TextContainer, .organic__content-text, .serp-item__text
        let snippet = '';
        const snip = el.querySelector('.TextContainer, .organic__content-text, .serp-item__text, .text-container');
        if (snip) snippet = snip.innerText;
        return {
          link: a ? a.href : null,
          snippet
        };
      }));
      let found = 0;
      for (let i = 0; i < items.length; i++) {
        const { link, snippet } = items[i];
        if (link) {
          const domain = extractDomain(link);
          if (domain && matchesCriteria(domain, snippet, config)) {
            results.add(link.split('?')[0]);
            found++;
            console.log(`[Yandex] Найдено: ${link}, Домен: ${domain}, Сниппет: ${snippet.substring(0, 50)}...`);
          } else {
            console.log(`[Yandex] Пропущено: ${link}, Домен: ${domain}, Сниппет: ${snippet.substring(0, 50)}...`);
          }
        } else {
          console.log(`[Yandex] Элемент без ссылки, индекс: ${i}`);
        }
      }
      console.log(`[Yandex] На странице найдено подходящих: ${found}`);
      await new Promise(resolve => setTimeout(resolve, config.delay));
    } catch (error) {
      console.error(`[Yandex] Ошибка на странице ${page}:`, error.message);
      if (error.stack) console.error(error.stack);
    }
  }
  await browser.close();
  if (results.size === 0) {
    console.warn('[Yandex] Не найдено ни одного результата. Проверьте структуру HTML или наличие блокировки.');
  }
  return Array.from(results);
}


const fs = require('fs');
const path = require('path');

// Основная функция только для Яндекса
async function parseYandexOnly(config) {
  console.log('=== Начинаем парсинг конкурентов (Яндекс) ===');
  console.log('Тема:', config.topic);
  console.log('Город:', config.location);
  console.log('Критерии:', JSON.stringify(config.criteria, null, 2));

  try {
    const yandexResults = await parseYandexResults(config);
    const uniqueYandex = [...new Set(yandexResults)];

    console.log('\nНайдено уникальных сайтов (Яндекс):', uniqueYandex.length);
    if (uniqueYandex.length === 0) {
      console.warn('Не найдено ни одного сайта. Проверьте логи выше, возможно, структура выдачи изменилась, сработала блокировка или слишком строгие фильтры.');
    } else {
      console.log('\nYandex:');
      uniqueYandex.forEach((url, i) => console.log(`${i + 1}. ${url}`));
      // Сохраняем результаты в файл
      const now = new Date();
      const pad = n => n.toString().padStart(2, '0');
      const fileName = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}-${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}-yandex.txt`;
      const filePath = path.join(__dirname, fileName);
      let fileContent = '';
      fileContent += 'Yandex:\n';
      fileContent += uniqueYandex.map((url, i) => `${i + 1}. ${url}`).join('\n') + '\n';
      fs.writeFileSync(filePath, fileContent, 'utf8');
      console.log(`\nРезультаты сохранены в файл: ${fileName}`);
    }
    return uniqueYandex;
  } catch (error) {
    console.error('Ошибка при парсинге:', error.message);
    if (error.stack) console.error(error.stack);
    return [];
  }
}

// Запуск парсера только для Яндекса
parseYandexOnly(config);