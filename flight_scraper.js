const puppeteer = require("puppeteer");

const delay = (time) => new Promise((resolve) => setTimeout(resolve, time));

const searchFlight = async (browser, from, to, date) => {
  const page = await browser.newPage();
  try {
    console.log(`\n=== Scraping: ${from} -> ${to} on ${date} ===`);

    const searchUrl = `https://www.google.com/travel/flights?q=Flights%20from%20${from}%20to%20${to}%20on%20${date}`;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded" });

    await page.waitForSelector("div[role='main']", { timeout: 30000 });

    // Give more time for results to appear
    await delay(10000);

    const results = await page.evaluate(() => {
      const extractText = (el) => el?.textContent?.trim() || "";

      const flights = [];
      const cards = document.querySelectorAll("div[role='main'] .pIav2d") || [];

      cards.forEach((card) => {
        const airline = extractText(card.querySelector(".sSHqwe.tPgKwe.ogfYpf"));
        const departure = extractText(card.querySelector(".mv1WYe span:nth-child(1)"));
        const arrival = extractText(card.querySelector(".mv1WYe span:nth-child(2)"));
        const price = extractText(card.querySelector(".YMlIz.FpEdX"));

        if (airline && departure && arrival && price) {
          flights.push({ airline, departure, arrival, price });
        }
      });

      return flights;
    });

    if (results.length === 0) {
      console.log("No flights found or structure may have changed.");
    } else {
      console.log(`Found ${results.length} flights:`);
      results.slice(0, 5).forEach((flight, i) => {
        console.log(
          `  ${i + 1}. ${flight.airline} | ${flight.departure} → ${flight.arrival} | ${flight.price}`
        );
      });
    }
  } catch (err) {
    console.error(`Error scraping ${from} -> ${to} on ${date}:`, err.message);
  } finally {
    await page.close();
  }
};

const runScraper = async () => {
  const browser = await puppeteer.launch({ headless: false });
  const routes = [
    { from: "DEL", to: "DXB", date: "2025-06-02" },
    { from: "DEL", to: "HKT", date: "2025-06-02" },
    { from: "DEL", to: "DPS", date: "2025-06-02" },
    { from: "DEL", to: "DXB", date: "2025-06-03" },
    { from: "DEL", to: "HKT", date: "2025-06-03" },
    { from: "DEL", to: "DPS", date: "2025-06-03" },
    { from: "DEL", to: "DXB", date: "2025-06-04" },
    { from: "DEL", to: "HKT", date: "2025-06-04" },
    { from: "DEL", to: "DPS", date: "2025-06-04" },
  ];

  for (const route of routes) {
    await searchFlight(browser, route.from, route.to, route.date);
    await delay(5000);
  }

  await browser.close();
};

runScraper();
