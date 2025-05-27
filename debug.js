const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://example.com');

  const elements = await page.$x('//h1');
  console.log('Number of <h1> elements found:', elements.length);

  await browser.close();
})();
