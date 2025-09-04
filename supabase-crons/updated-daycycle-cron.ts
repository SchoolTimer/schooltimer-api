import { serve } from "https://deno.land/std@0.223.0/http/server.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";
// === Helpers ===
function getDates() {
  const dates = {};
  [
    "today",
    "tomorrow",
    "after"
  ].forEach((key, idx)=>{
    const d = new Date();
    d.setDate(d.getDate() + idx);
    const long = d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric"
    });
    const noComma = long.replace(",", "");
    dates[key] = {
      long,
      no_comma: noComma
    };
  });
  return dates;
}
function extractDayNumber(text) {
  for(let i = 1; i <= 6; i++){
    if (text.includes(`Day ${i}`)) return String(i);
  }
  return null;
}
function nextDayNumber(n, step = 1) {
  return String((parseInt(n) - 1 + step) % 6 + 1);
}
function detectSchedule(text, baseDay) {
  const schedules = {
    "HS-ASchedule": "A",
    "HS-BSchedule": "B",
    "HS-CSchedule": "C",
    "HS-DSchedule": "D"
  };
  for(const key in schedules){
    if (text.includes(key)) {
      return baseDay + schedules[key];
    }
  }
  return baseDay;
}
// === Main Edge Function ===
serve(async ()=>{
  try {
    const url = "https://phs.parklandsd.org/about/calendar";
    console.log(`Fetching data from: ${url} at ${new Date().toISOString()}`);
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
    const dates = getDates();
    let tag = null;
    let cycleDay = null;
    // Find base cycle day
    const events = doc.querySelectorAll("article.fsCalendarBlockEvent");
    for (const ev of events){
      const text = ev.textContent?.trim() || "";
      for(const key in dates){
        if (text.includes(dates[key].long) || text.includes(dates[key].no_comma)) {
          tag = key;
          cycleDay = extractDayNumber(text);
        }
      }
    }
    if (!cycleDay) {
      console.error("No cycle day found");
      return new Response(JSON.stringify({
        error: "No cycle day found"
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    // Collect schedule strings
    const scraped = {
      today: "N/A",
      tomorrow: "N/A",
      after: "N/A"
    };
    const divs = doc.querySelectorAll("div.fsStateHasEvents");
    for (const div of divs){
      const text = div.textContent?.replace(/\n/g, " ") || "";
      if (!text.includes("Schedule")) continue;
      for(const key in dates){
        if (text.includes(dates[key].long) || text.includes(dates[key].no_comma)) {
          scraped[key] = text;
        }
      }
    }
    // Resolve cycle numbers
    let cycles = {};
    if (tag === "today") {
      cycles = {
        today: cycleDay,
        tomorrow: nextDayNumber(cycleDay, 1),
        after: nextDayNumber(cycleDay, 2)
      };
    } else if (tag === "tomorrow") {
      cycles = {
        today: null,
        tomorrow: cycleDay,
        after: nextDayNumber(cycleDay, 1)
      };
    } else if (tag === "after") {
      cycles = {
        today: null,
        tomorrow: null,
        after: cycleDay
      };
    }
    // Build final results
    const finals = {};
    for (const key of [
      "today",
      "tomorrow",
      "after"
    ]){
      if (scraped[key] === "N/A" || !cycles[key]) {
        finals[key] = "N/A";
      } else {
        const cleanText = scraped[key].replace(/ /g, "");
        finals[key] = detectSchedule(cleanText, cycles[key]);
      }
    }
    console.log("Scraped Results:");
    console.log(`Today: ${finals.today}`);
    console.log(`Tomorrow: ${finals.tomorrow}`);
    console.log(`Day after tomorrow: ${finals.after}`);
    // Push to API
    const apiUrl = Deno.env.get("DAYCYCLE_UPDATE_API");
    const apiKey = Deno.env.get("API_KEY");
    if (!apiUrl) {
      console.error("Error: DAYCYCLE_UPDATE_API not set");
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
      console.error("Error: API_KEY not set");
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
      today: finals.today,
      tomorrow: finals.tomorrow,
      next_day: finals.after
    };
    const headers = {
      "Content-Type": "application/json",
      "api-key": apiKey
    };
    console.log(`Sending POST to ${apiUrl} with payload: ${JSON.stringify(payload)}`);
    try {
      const apiResp = await fetch(apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });
      const text = await apiResp.text();
      console.log(`API Response Status: ${apiResp.status}`);
      console.log(`API Response Text: ${text}`);
      if (!apiResp.ok) {
        return new Response(JSON.stringify({
          error: `Update failed ${apiResp.status}`
        }), {
          status: 500,
          headers: {
            "Content-Type": "application/json"
          }
        });
      }
    } catch (e) {
      console.error(`Network/API error: ${e}`);
      return new Response(JSON.stringify({
        error: `Network/API error: ${e}`
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    return new Response(JSON.stringify({
      today: finals.today,
      tomorrow: finals.tomorrow,
      day_after_tomorrow: finals.after
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    });
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
