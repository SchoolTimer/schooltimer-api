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
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Accept, api-key"
  );

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const apiKey = req.headers["api-key"];

  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(403).json({ error: "Invalid API key" });
  }

  try {
    if (req.method === "GET") {
      // Get current food menu
      const { data, error } = await supabase
        .from("foodmenus")
        .select("*")
        .eq("id", "current")
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Foodmenu fetch error:", error);
      }

      res.status(200).json(data || { breakfast: [], lunch: [] });
    } else if (req.method === "POST") {
      const { breakfast, lunch } = req.body;

      if (!Array.isArray(breakfast) || !Array.isArray(lunch)) {
        return res.status(400).json({ error: "Invalid data format" });
      }

      // Update or insert food menu
      const { data, error } = await supabase
        .from("foodmenus")
        .upsert({
          id: "current",
          breakfast,
          lunch,
          last_updated: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error("Foodmenu update error:", error);
        return res.status(500).json({ error: "Update failed" });
      }

      res.status(200).json({ message: "Food menu updated successfully", data });
    } else {
      res.status(405).json({ error: "Method not allowed" });
    }
  } catch (err) {
    console.error("Supabase Foodmenu API Error:", err);
    res.status(500).json({
      error: "Server error",
      details: err.message,
      timestamp: new Date().toISOString(),
    });
  }
};
