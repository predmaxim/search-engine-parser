# search-engine-parser

Yandex search results parser for collecting links by topic and region.

[Русская версия](./README_RU.md)

## Description
This project automatically collects unique links from Yandex search results for a given topic and region. The script uses Puppeteer to emulate a browser, supports filtering by keywords and domains, and saves results to a text file.

## Features
- Yandex search with real user emulation
- Customizable topic and region
- Filtering by keywords in snippets
- Excluding unwanted domains
- Saving unique links to a file
- Minimal console output (progress and summary only)

## Quick Start
1. Install dependencies:
   ```bash
   npm install
   ```
2. Run the parser:
   ```bash
   npm run start
   ```

## Configuration
All parameters are set in `src/index.js` in the `config` object:
- `topic` — search topic
- `location` — search region
- `criteria` — keyword filters
- `ignoreDomains` — list of domains to exclude
- `pages` — number of pages to parse
- `delay` — delay between pages (ms)
- `yandexCookiesPath` — path to Yandex cookies (optional, recommended)

## Results
Links are saved to a text file with the date and time in the filename. Example:
```
22-07-2025-14-30-12-yandex.txt
```

## Dependencies
- [Node.js](https://nodejs.org/)
- [Puppeteer](https://pptr.dev/)

## Notes
- For best results, use up-to-date Yandex cookies (optional, but recommended).
- All result and temp files are ignored by git (see `.gitignore`).
- Google search is not supported (removed by request).

## License
MIT

[Русская версия](./README_RU.md)
