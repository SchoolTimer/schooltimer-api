import { serve } from "https://deno.land/std@0.223.0/http/server.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";
// Helper function to format date as "Tuesday, August 25"
function getFormattedDate(deltaDays) {
  const d = new Date();
  d.setDate(d.getDate() + deltaDays);
  const options = {
    weekday: "long",
    month: "long",
    day: "numeric"
  };
  return d.toLocaleDateString("en-US", options).replace(/, \d{1}\b/, (match)=>match.replace(",", ", "));
}
// Helper function to extract schedule and update current day
function extractSchedule(eventString, currentDay) {
  const scheduleMatch = eventString.match(/HS - ([ABCD]) Schedule/);
  if (eventString.includes("HOLIDAY") || eventString.includes("School Closed")) {
    return [
      "N/A",
      currentDay
    ];
  }
  if (eventString.includes("1st Day of School") && currentDay === null) {
    currentDay = 1; // Assume first day of school is Day 1
  }
  if (scheduleMatch && currentDay !== null) {
    return [
      `${currentDay}${scheduleMatch[1]}`,
      currentDay
    ];
  }
  return [
    "N/A",
    currentDay
  ];
}
// Main handler for the Supabase Edge Function
serve(async (req)=>{
  try {
    const url = "https://phs.parklandsd.org/about/calendar";
    console.log(`Fetching data from: ${url} at ${new Date().toISOString()}`);
    // Fetch the webpage
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch page: Status ${response.status}`);
      return new Response(JSON.stringify({
        error: `Failed to fetch page: Status ${response.status}`
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    if (!doc) {
      console.error("Failed to parse HTML");
      return new Response(JSON.stringify({
        error: "Failed to parse HTML"
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    // Get target dates
    const today = getFormattedDate(0);
    const tomorrow = getFormattedDate(1);
    const dayAfterTomorrow = getFormattedDate(2);
    const targetDates = [
      today,
      tomorrow,
      dayAfterTomorrow
    ];
    const results = Object.fromEntries(targetDates.map((date)=>[
        date,
        "N/A"
      ]));
    let currentDay = null;
    let schoolDays = 0;
    // Process events
    const events = doc.querySelectorAll("div.fsStateHasEvents");
    if (events.length === 0) {
      console.error("No events found with class 'fsStateHasEvents'");
      return new Response(JSON.stringify({
        error: "No events found on the page"
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    for (const event of events){
      const fullString = event.textContent?.trim().replace(/\n/g, " ") || "";
      console.log(`Processing event: ${fullString}`);
      // Check if this is a school day
      if (!fullString.includes("HOLIDAY") && !fullString.includes("School Closed")) {
        if (fullString.includes("1st Day of School")) {
          currentDay = 1; // Reset to Day 1
        } else if (currentDay !== null) {
          schoolDays += 1;
          currentDay = schoolDays % 4 + 1; // Cycle through Day 1-4
        }
      }
      // Extract schedule and update current day
      const [result, updatedDay] = extractSchedule(fullString, currentDay);
      currentDay = updatedDay;
      // Check for target dates in the event
      for (const targetDate of targetDates){
        if (fullString.includes(targetDate) && result !== "N/A") {
          results[targetDate] = result;
        }
      }
    }
    // Prepare data for API
    const final1 = results[today];
    const final2 = results[tomorrow];
    const final3 = results[dayAfterTomorrow];
    console.log(`Scraped Results:`);
    console.log(`Today: ${final1}`);
    console.log(`Tomorrow: ${final2}`);
    console.log(`Day after tomorrow: ${final3}`);
    // Push data to Vercel API
    const apiUrl = Deno.env.get("DAYCYCLE_UPDATE_API");
    const apiKey = Deno.env.get("API_KEY");
    if (!apiUrl) {
      console.error("Error: DAYCYCLE_UPDATE_API not set in environment variables");
      return new Response(JSON.stringify({
        error: "DAYCYCLE_UPDATE_API not set"
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    if (!apiKey) {
      console.error("Error: API_KEY not set in environment variables");
      return new Response(JSON.stringify({
        error: "API_KEY not set"
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    const payload = {
      today: final1,
      tomorrow: final2,
      next_day: final3
    };
    const headers = {
      "Content-Type": "application/json",
      "api-key": apiKey
    };
    console.log(`Sending POST to ${apiUrl} with payload: ${JSON.stringify(payload)}`);
    try {
      const apiResponse = await fetch(apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });
      const apiResponseText = await apiResponse.text();
      console.log(`API Response Status: ${apiResponse.status}`);
      console.log(`API Response Text: ${apiResponseText}`);
      if (!apiResponse.ok) {
        console.error(`Error: Update failed with status ${apiResponse.status}, response: ${apiResponseText}`);
        return new Response(JSON.stringify({
          error: `Update failed with status ${apiResponse.status}`
        }), {
          status: 500,
          headers: {
            "Content-Type": "application/json"
          }
        });
      }
      console.log("Day cycle updated successfully");
      // Return local results
      return new Response(JSON.stringify({
        today: final1,
        tomorrow: final2,
        day_after_tomorrow: final3
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      });
    } catch (e) {
      console.error(`Network or API error: ${e}`);
      return new Response(JSON.stringify({
        error: `Network or API error: ${e}`
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
  } catch (e) {
    console.error(`Unexpected error: ${e}`);
    return new Response(JSON.stringify({
      error: `Unexpected error: ${e}`
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
});
