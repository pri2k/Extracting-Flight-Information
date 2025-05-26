const puppeteer = require("puppeteer");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Your test route and date
  const from = "DEL";
  const to = "DXB";
  const date = "2025-06-08";

  try {
    const searchUrl = `https://www.google.com/travel/flights?q=Flights%20from%20${from}%20to%20${to}%20on%20${date}`;
    console.log(`Navigating to ${searchUrl}`);

    await page.goto(searchUrl, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("div[role='main']", { timeout: 30000 });
    await delay(10000); // Wait for page to fully render and flights to load

    const results = await page.evaluate(() => {
      const cards = document.querySelectorAll("div[role='main'] .pIav2d") || [];
      const flights = [];

      cards.forEach((card, index) => {
        const airline = card.querySelector(".sSHqwe.tPgKwe.ogfYpf")?.innerText || "";
        const departureFull = card.querySelector(".mv1WYe span:nth-child(1)")?.innerText || "";
        const arrivalFull = card.querySelector(".mv1WYe span:nth-child(2)")?.innerText || "";
        const price = card.querySelector(".YMlIz.FpEdX")?.innerText || "";

        // Extract stop type - often in a span with role 'text' or near segments info
        // This might vary, so we check multiple selectors and fallback to text search if needed
        let stopType = "";
        // Try common selector that shows stop info in Google Flights UI
        const stopElem = card.querySelector(".J0lOec");  // This class often holds stops info
        if (stopElem) {
          stopType = stopElem.innerText.trim();
        } else {
          // Fallback: look for phrases like 'Nonstop' or '1 stop' in the card text
          const text = card.innerText;
          const match = text.match(/(Nonstop|\d+\sstop[s]?)/i);
          if (match) stopType = match[0];
        }

        flights.push({
          index,
          airline,
          departureFull,
          arrivalFull,
          price,
          stopType,
        });
      });

      return flights;
    });

    console.log(JSON.stringify(results, null, 2));
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await browser.close();
  }
})();
