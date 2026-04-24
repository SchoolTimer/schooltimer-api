import { serve } from "https://deno.land/std@0.223.0/http/server.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

// Returns YYYY-MM-DD for today + deltaDays
function dateStr(deltaDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().split("T")[0];
}

// Returns "April 24" style string (no leading zero) for today + deltaDays
function shortDate(deltaDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + deltaDays);
  const month = d.toLocaleDateString("en-US", { month: "long" });
  return `${month} ${d.getDate()}`;
}

function parseDayCycle(text: string): string {
  if (/HOLIDAY|School Closed|Schools Closed/i.test(text)) return "N/A";
  const dayMatch = text.match(/Day\s+([1-6])/i);
  const schedMatch = text.match(/HS - ([ABCD]) Schedule/i);
  if (dayMatch && schedMatch) return dayMatch[1] + schedMatch[1];
  return "N/A";
}

// Fetch the FinalSite calendar grid element for the month containing `date`.
// Element 16751 is the main calendar grid on the PHS calendar page.
async function fetchMonthGrid(date: string): Promise<Record<string, string>> {
  const url = `https://phs.parklandsd.org/fs/elements/16751?date=${date}`;
  console.log(`Fetching calendar grid: ${url}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch grid: ${response.status}`);
  }

  const html = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  if (!doc) throw new Error("Failed to parse HTML");

  const dayMap: Record<string, string> = {};
  const dayboxes = doc.querySelectorAll(".fsStateHasEvents");
  for (const el of dayboxes) {
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    // Text starts like "Friday, April 24 Day 5 ..."
    const match = text.match(
      /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+([A-Za-z]+ \d+)/
    );
    if (match) dayMap[match[1]] = text;
  }
  return dayMap;
}

// === Main Edge Function ===
serve(async () => {
  try {
    const today = dateStr(0);
    console.log(`Scraping day cycle for ${today}`);

    let dayMap = await fetchMonthGrid(today);

    // If tomorrow or next_day fall outside this month, fetch the next month too
    const needsMore =
      !dayMap[shortDate(1)] || !dayMap[shortDate(2)];
    if (needsMore) {
      const nextMonthDate = dateStr(5);
      console.log(`Fetching next month grid for ${nextMonthDate}`);
      try {
        const nextMap = await fetchMonthGrid(nextMonthDate);
        for (const [k, v] of Object.entries(nextMap)) {
          if (!dayMap[k]) dayMap[k] = v;
        }
      } catch (e) {
        console.error(`Failed to fetch next month: ${e}`);
      }
    }

    const finals = {
      today: parseDayCycle(dayMap[shortDate(0)] ?? ""),
      tomorrow: parseDayCycle(dayMap[shortDate(1)] ?? ""),
      next_day: parseDayCycle(dayMap[shortDate(2)] ?? ""),
    };

    console.log("Scraped Results:");
    console.log(`Today (${shortDate(0)}):    ${finals.today}`);
    console.log(`Tomorrow (${shortDate(1)}): ${finals.tomorrow}`);
    console.log(`Next day (${shortDate(2)}): ${finals.next_day}`);

    // Push to API
    const apiUrl = Deno.env.get("DAYCYCLE_UPDATE_API");
    const apiKey = Deno.env.get("API_KEY");

    if (!apiUrl) {
      return new Response(JSON.stringify({ error: "DAYCYCLE_UPDATE_API not set" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API_KEY not set" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`Sending POST to ${apiUrl} with payload:`, JSON.stringify(finals));

    const apiResp = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey },
      body: JSON.stringify(finals),
    });

    const respText = await apiResp.text();
    console.log(`API Response: ${apiResp.status} ${respText}`);

    if (!apiResp.ok) {
      return new Response(
        JSON.stringify({ error: `Update failed: ${apiResp.status}` }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(finals), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(`Unexpected error: ${e}`);
    return new Response(JSON.stringify({ error: `Unexpected error: ${e}` }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
