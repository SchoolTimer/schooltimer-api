const axios = require("axios");
const cheerio = require("cheerio");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

// Returns YYYY-MM-DD for today + deltaDays (local time)
function dateStr(deltaDays) {
  const d = new Date();
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().split("T")[0];
}

// Returns "April 24" style string (no leading zero)
function shortDate(deltaDays) {
  const d = new Date();
  d.setDate(d.getDate() + deltaDays);
  const month = d.toLocaleDateString("en-US", { month: "long" });
  return `${month} ${d.getDate()}`;
}

// Returns "Friday, April 24" style string (used in fsStateHasEvents text)
function longDate(deltaDays) {
  const d = new Date();
  d.setDate(d.getDate() + deltaDays);
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  const month = d.toLocaleDateString("en-US", { month: "long" });
  return `${weekday} ${month} ${d.getDate()}`;
}

function parseDayCycle(text) {
  const isHoliday = /HOLIDAY|School Closed|Schools Closed/i.test(text);
  if (isHoliday) return "N/A";

  const dayMatch = text.match(/Day\s+([1-6])/i);
  const schedMatch = text.match(/HS - ([ABCD]) Schedule/i);

  if (dayMatch && schedMatch) {
    return dayMatch[1] + schedMatch[1];
  }
  return "N/A";
}

async function scrapeDayCycle() {
  const today = dateStr(0);
  console.log(`Scraping day cycle for ${today}`);

  // Fetch the calendar grid for the current month via FinalSite elements API.
  // Element 16751 is the main calendar grid on the PHS calendar page.
  // Passing ?date= returns the month containing that date.
  const url = `https://phs.parklandsd.org/fs/elements/16751?date=${today}`;
  console.log(`Fetching: ${url}`);

  let page;
  try {
    page = await axios.get(url, { timeout: 15000 });
  } catch (err) {
    console.error(`Failed to fetch calendar: ${err.message}`);
    process.exit(1);
  }

  const $ = cheerio.load(page.data);

  // Build a map of "Month Day" -> full text for each event day
  const dayMap = {};
  $(".fsStateHasEvents").each((_, el) => {
    const text = $(el).text().trim().replace(/\s+/g, " ");
    // Each element starts with the full date like "Friday April 24 ..."
    // Extract "April 24" portion
    const match = text.match(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+([A-Za-z]+ \d+)/);
    if (match) {
      dayMap[match[1]] = text;
    }
  });

  console.log("Days found in calendar:", Object.keys(dayMap).join(", "));

  const results = {
    today: parseDayCycle(dayMap[shortDate(0)] || ""),
    tomorrow: parseDayCycle(dayMap[shortDate(1)] || ""),
    next_day: parseDayCycle(dayMap[shortDate(2)] || ""),
  };

  // If today/tomorrow/next_day spans a month boundary, fetch next month too
  const needsNextMonth = results.tomorrow === "N/A" || results.next_day === "N/A";
  if (needsNextMonth) {
    const nextMonthDate = dateStr(5); // 5 days ahead guaranteed to be in next month if we're near end
    const url2 = `https://phs.parklandsd.org/fs/elements/16751?date=${nextMonthDate}`;
    console.log(`Also fetching next month: ${url2}`);
    try {
      const page2 = await axios.get(url2, { timeout: 15000 });
      const $2 = cheerio.load(page2.data);
      $2(".fsStateHasEvents").each((_, el) => {
        const text = $2(el).text().trim().replace(/\s+/g, " ");
        const match = text.match(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+([A-Za-z]+ \d+)/);
        if (match && !dayMap[match[1]]) {
          dayMap[match[1]] = text;
        }
      });
      // Re-compute missing values
      if (results.tomorrow === "N/A") results.tomorrow = parseDayCycle(dayMap[shortDate(1)] || "");
      if (results.next_day === "N/A") results.next_day = parseDayCycle(dayMap[shortDate(2)] || "");
    } catch (err) {
      console.error(`Failed to fetch next month: ${err.message}`);
    }
  }

  console.log("\nScraped Results:");
  console.log(`Today (${shortDate(0)}):     ${results.today}`);
  console.log(`Tomorrow (${shortDate(1)}):  ${results.tomorrow}`);
  console.log(`Next day (${shortDate(2)}):  ${results.next_day}`);

  // Push to API
  const apiUrl = process.env.DAYCYCLE_UPDATE_API;
  const apiKey = process.env.API_KEY;

  if (!apiUrl) {
    console.error("Error: DAYCYCLE_UPDATE_API not set");
    process.exit(1);
  }
  if (!apiKey) {
    console.error("Error: API_KEY not set");
    process.exit(1);
  }

  console.log(`\nSending POST to ${apiUrl} with payload:`, results);
  try {
    const response = await axios.post(apiUrl, results, {
      headers: { "Content-Type": "application/json", "api-key": apiKey },
      timeout: 10000,
    });
    console.log(`API Response Status: ${response.status}`);
    if (response.status === 200) {
      console.log("Day cycle updated successfully");
    } else {
      console.error(`Update failed with status ${response.status}:`, response.data);
    }
  } catch (err) {
    console.error(`Network or API error: ${err.message}`);
  }
}

scrapeDayCycle();
