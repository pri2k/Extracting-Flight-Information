// Create a new file called debug_selectors.js
const { chromium } = require('playwright');

async function debugSelectors() {
  console.log('=== DEBUGGING GOOGLE FLIGHTS SELECTORS ===');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  await page.goto('https://www.google.com/travel/flights');
  await page.waitForTimeout(5000);
  
  console.log('Analyzing page elements...');
  
  // Find all inputs
  const inputs = await page.$$('input');
  console.log(`\nFound ${inputs.length} inputs:`);
  
  for (let i = 0; i < inputs.length; i++) {
    const placeholder = await inputs[i].getAttribute('placeholder');
    const ariaLabel = await inputs[i].getAttribute('aria-label');
    console.log(`Input ${i}: placeholder="${placeholder}", aria-label="${ariaLabel}"`);
  }
  
  await page.waitForTimeout(30000); // Keep open for inspection
  await browser.close();
}

debugSelectors();