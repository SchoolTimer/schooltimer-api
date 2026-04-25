const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
  // CORS headers for browser requests
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    // Fetch all tables in parallel
    const [
      { data: daycycle,        error: daycycleError },
      { data: foodmenu,        error: foodmenuError },
      { data: bellSchedules,   error: bellError },
      { data: schoolDates,     error: datesError },
      { data: customSchedule,  error: customError },
    ] = await Promise.all([
      supabase.from("daycycles").select("*").eq("id", "current").single(),
      supabase.from("foodmenus").select("*").eq("id", "current").single(),
      supabase.from("bell_schedules").select("*").order("letter"),
      supabase.from("school_dates").select("*").order("id", { ascending: false }).limit(1).single(),
      supabase.from("custom_schedules").select("*").eq("enabled", true).maybeSingle(),
    ]);

    if (daycycleError && daycycleError.code !== "PGRST116") console.error("Daycycle error:", daycycleError);
    if (foodmenuError && foodmenuError.code !== "PGRST116") console.error("Foodmenu error:", foodmenuError);
    if (bellError     && bellError.code     !== "PGRST116") console.error("Bell schedules error:", bellError);
    if (datesError    && datesError.code    !== "PGRST116") console.error("School dates error:", datesError);
    if (customError   && customError.code   !== "PGRST116") console.error("Custom schedule error:", customError);

    // Shape bell schedules into a keyed map { A: [...slots], B: [...slots], ... }
    const schedules = {};
    for (const row of (bellSchedules || [])) {
      schedules[row.letter] = {
        name: row.name,
        slots: row.slots,
        last_updated: row.last_updated,
      };
    }

    // If a custom schedule is enabled, include it as a top-level entry and
    // also expose it under schedules.CUSTOM so consumers that key by letter
    // can pick it up easily.
    let custom = null;
    if (customSchedule) {
      custom = {
        id: customSchedule.id,
        name: customSchedule.name,
        slots: customSchedule.slots,
        last_updated: customSchedule.last_updated,
      };
      schedules.CUSTOM = { name: custom.name, slots: custom.slots, last_updated: custom.last_updated };
    }

    res.status(200).json({
      daycycle: daycycle || {
        id: "current",
        today: "N/A",
        tomorrow: "N/A",
        next_day: "N/A",
        last_updated: null,
      },
      foodmenu: foodmenu || {
        id: "current",
        breakfast: [],
        lunch: [],
        last_updated: null,
      },
      schedules,
      custom_schedule: custom,
      school_dates: schoolDates || null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Supabase API Error:", err);
    res.status(500).json({
      error: "Database error",
      details: err.message,
      timestamp: new Date().toISOString(),
    });
  }
};
