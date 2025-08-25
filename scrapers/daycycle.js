const axios = require("axios");
const cheerio = require("cheerio");

const dotenv = require("dotenv");
const path = require("path");

// Load .env from the parent directory (project root)
dotenv.config({ path: path.join(__dirname, "..", ".env") });

function getFormattedDate(deltaDays) {
  // Format date as "Tuesday, August 25" (no leading zero)
  const d = new Date();
  d.setDate(d.getDate() + deltaDays);
  const dayName = d.toLocaleDateString("en-US", { weekday: "long" });
  const monthName = d.toLocaleDateString("en-US", { month: "long" });
  const day = d.getDate();
  return `${dayName}, ${monthName} ${day}`;
}

function extractSchedule(eventString, currentDay) {
  const scheduleMatch = eventString.match(/HS - ([ABCD]) Schedule/);
  if (
    eventString.includes("HOLIDAY") ||
    eventString.includes("School Closed")
  ) {
    return ["N/A", currentDay];
  }
  if (eventString.includes("1st Day of School") && currentDay === null) {
    currentDay = 1; // Assume first day of school is Day 1
  }
  if (scheduleMatch && currentDay !== null) {
    return [`${currentDay}${scheduleMatch[1]}`, currentDay];
  }
  return ["N/A", currentDay];
}

async function scrapeDayCycle() {
  const url = "https://phs.parklandsd.org/about/calendar";
  const today = new Date().toISOString().split("T")[0];
  console.log(`Fetching data from: ${url} at ${today}`);

  try {
    const page = await axios.get(url);
    if (page.status !== 200) {
      console.log(`Failed to fetch page: Status ${page.status}, ${page.data}`);
      process.exit(1);
    }

    const $ = cheerio.load(page.data);
    const todayFormatted = getFormattedDate(0);
    const tomorrow = getFormattedDate(1);
    const dayAfterTomorrow = getFormattedDate(2);
    const targetDates = [todayFormatted, tomorrow, dayAfterTomorrow];
    const results = {};
    targetDates.forEach((date) => (results[date] = "N/A"));

    let currentDay = null; // Track the current day number
    let schoolDays = 0; // Track school days to increment day number

    $(".fsStateHasEvents").each((index, element) => {
      const fullString = $(element).text().trim().replace(/\n/g, " ");
      console.log(`Processing event: ${fullString}`);

      // Check if this is a school day (not a holiday)
      if (
        !fullString.includes("HOLIDAY") &&
        !fullString.includes("School Closed")
      ) {
        if (fullString.includes("1st Day of School")) {
          currentDay = 1; // Reset to Day 1 for the first school day
        } else if (currentDay !== null) {
          schoolDays++;
          currentDay = (schoolDays % 4) + 1; // Cycle through Day 1-4
        }
      }

      // Extract schedule and update currentDay
      const [result, updatedCurrentDay] = extractSchedule(
        fullString,
        currentDay
      );
      currentDay = updatedCurrentDay;

      // Check for target dates in the event
      targetDates.forEach((targetDate) => {
        if (fullString.includes(targetDate) && result !== "N/A") {
          results[targetDate] = result;
        }
      });
    });

    // Prepare data for API
    const final1 = results[todayFormatted];
    const final2 = results[tomorrow];
    const final3 = results[dayAfterTomorrow];

    console.log("\nScraped Results:");
    console.log(`Today: ${final1}`);
    console.log(`Tomorrow: ${final2}`);
    console.log(`Day after tomorrow: ${final3}`);

    // Push data to Vercel API
    const apiUrl = process.env.DAYCYCLE_UPDATE_API;
    console.log(`API URL: ${apiUrl}`);
    const apiKey = process.env.API_KEY;

    if (!apiUrl) {
      console.log(
        "Error: DAYCYCLE_UPDATE_API not set in environment variables"
      );
      process.exit(1);
    }
    if (!apiKey) {
      console.log("Error: API_KEY not set in environment variables");
      process.exit(1);
    }

    const payload = {
      today: final1,
      tomorrow: final2,
      next_day: final3,
    };

    const headers = {
      "Content-Type": "application/json",
      "api-key": apiKey,
    };

    console.log(`Sending POST to ${apiUrl} with payload:`, payload);

    try {
      const response = await axios.post(apiUrl, payload, {
        headers,
        timeout: 10000,
      });
      console.log(`API Response Status: ${response.status}`);
      console.log(`API Response Text: ${response.data}`);
      if (response.status !== 200) {
        console.log(
          `Error: Update failed with status ${response.status}, response:`,
          response.data
        );
      } else {
        console.log("Day cycle updated successfully");
      }
    } catch (error) {
      console.log(`Network or API error: ${error.message}`);
    }

    // Print local results
    console.log("\nLocal Results:");
    console.log(`Today: ${final1}`);
    console.log(`Tomorrow: ${final2}`);
    console.log(`Day after tomorrow: ${final3}`);
  } catch (error) {
    console.log(`Error fetching page: ${error.message}`);
    process.exit(1);
  }
}

// Run the scraper
scrapeDayCycle();
