const puppeteer = require("puppeteer");
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
require('dotenv').config();

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const TOKEN_PATH = path.join(__dirname, "token.json");
const CREDENTIALS_PATH = path.join(__dirname, "credentials.json");

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = "Flights";

const delay = (time) => new Promise((resolve) => setTimeout(resolve, time));

async function authorize() {
  const content = fs.readFileSync(CREDENTIALS_PATH);
  const credentials = JSON.parse(content);
  const { client_secret, client_id, redirect_uris } = credentials.installed;

  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  if (fs.existsSync(TOKEN_PATH)) {
    const token = fs.readFileSync(TOKEN_PATH);
    oAuth2Client.setCredentials(JSON.parse(token));
  } else {
    throw new Error("Token not found, please generate OAuth token first.");
  }
  return oAuth2Client;
}

async function appendFlights(auth, flights, route, date) {
  const sheets = google.sheets({ version: "v4", auth });

  const values = flights.map(({ airline, departure, arrival, price, stopType, bookingUrl }) => [
    route.from, route.to, departure, arrival, airline, price, stopType, date, bookingUrl
  ]);

  const resource = { values };

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:I`,
    valueInputOption: "RAW",
    resource,
  });
}

const searchFlight = async (browser, from, to, date, auth) => {
  const page = await browser.newPage();
  try {
    console.log(`\n=== Scraping: ${from} -> ${to} on ${date} ===`);
    const searchUrl = `https://www.google.com/travel/flights?q=Flights%20from%20${from}%20to%20${to}%20on%20${date}`;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("div[role='main']", { timeout: 30000 });
    await delay(10000); // Wait for content load

    // ✅ Try to toggle round-trip to one-way
    try {
      const oneWayToggleXpath = "//div[@role='tablist']//div[contains(text(),'Round trip') or contains(text(),'One-way')]";
      const [toggleButton] = await page.$x(oneWayToggleXpath);
      if (toggleButton) {
        const buttonText = await page.evaluate(el => el.innerText, toggleButton);
        if (buttonText.includes("Round trip")) {
          await toggleButton.click();
          await delay(1000);
          const [oneWayOption] = await page.$x("//div[@role='menu']//div[contains(text(),'One-way')]");
          if (oneWayOption) {
            await oneWayOption.click();
            await delay(5000); // Wait for page to reload after toggle
            console.log("✅ Switched to One-way trip");
          } else {
            console.log("⚠️ One-way option not found in menu.");
          }
        } else {
          console.log("One-way already selected.");
        }
      } else {
        console.log("⚠️ Could not find trip type toggle button.");
      }
    } catch (err) {
      console.error("❌ Failed to switch to One-way:", err.message);
    }

    await delay(10000); // Let flights reload fully

    const results = await page.evaluate((searchUrl) => {
      const cards = document.querySelectorAll("div[role='main'] .pIav2d") || [];
      const flights = [];

      cards.forEach((card) => {
        const airline = card.querySelector(".sSHqwe.tPgKwe.ogfYpf")?.innerText || "";
        const departureFull = card.querySelector("[aria-label*='Departure time']")?.innerText
                           || card.querySelector(".mv1WYe span:nth-child(1)")?.innerText || "";
        const arrivalFull = card.querySelector("[aria-label*='Arrival time']")?.innerText
                           || card.querySelector(".mv1WYe span:nth-child(2)")?.innerText || "";
        const price = card.querySelector(".YMlIz.FpEdX")?.innerText || "";

        let stopType = "";
        const stopElem = card.querySelector(".J0lOec");
        if (stopElem) {
          stopType = stopElem.innerText.trim();
        } else {
          const text = card.innerText;
          const match = text.match(/(Nonstop|\d+\sstop[s]?)/i);
          if (match) stopType = match[0];
        }

        const timeRegex = /([0-9]{1,2}:[0-9]{2}\s?[APMapm]{2})/;
        const departureMatch = departureFull.match(timeRegex);
        const arrivalMatch = arrivalFull.match(timeRegex);
        const departure = departureMatch ? departureMatch[1] : "";
        const arrival = arrivalMatch ? arrivalMatch[1] : "";

        flights.push({
          airline,
          departureFull,
          arrivalFull,
          departure,
          arrival,
          price,
          stopType,
          bookingUrl: searchUrl,
        });
      });

      return flights;
    }, searchUrl);

    console.log(`Found ${results.length} flights.`);
    if (results.length > 0) {
      await appendFlights(auth, results, { from, to }, date);
    }
  } catch (err) {
    console.error(`Error scraping ${from} -> ${to} on ${date}:`, err.message);
  } finally {
    await page.close();
  }
};

function generateDates(startDate, monthsAhead) {
  const dates = [];
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + monthsAhead);

  let current = new Date(startDate);
  while (current <= endDate) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
    current.setDate(current.getDate() + 1); 
  }
  return dates;
}

const runScraper = async () => {
  const auth = await authorize();

  const sheets = google.sheets({ version: "v4", auth });
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A1`,
    valueInputOption: "RAW",
    resource: {
      values: [["✅ Sheets test successful", new Date().toISOString()]],
    },
  });

  const browser = await puppeteer.launch({ headless: false });

  const departures = ["DEL"];
  const arrivals = ["DXB"];
  const dates = generateDates(new Date("2025-06-01"), 0); // You can increase to 6

  for (const from of departures) {
    for (const to of arrivals) {
      for (const date of dates) {
        await searchFlight(browser, from, to, date, auth);
        await delay(5000);
      }
    }
  }

  await browser.close();
};

runScraper();
