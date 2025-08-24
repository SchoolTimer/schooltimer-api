const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
  const apiKey = req.headers['api-key'];

  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(403).json({ error: 'Invalid API key' });
  }

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('daycycles')
        .select('*')
        .eq('id', 'current')
        .single();
      if (error && error.code !== 'PGRST116') console.error('Daycycle fetch error:', error);
      res.status(200).json(data || { today: 'N/A', tomorrow: 'N/A', next_day: 'N/A' });
    } else if (req.method === 'POST') {
      const { today, tomorrow, nextDay } = req.body;
      if (!today || !tomorrow || !nextDay) return res.status(400).json({ error: 'Invalid data' });
      const { data, error } = await supabase
        .from('daycycles')
        .upsert({
          id: 'current',
          today,
          tomorrow,
          next_day,
          last_updated: new Date().toISOString()
        })
        .select()
        .single();
      if (error) {
        console.error('Daycycle update error:', error);
        return res.status(500).json({ error: 'Update failed' });
      }
      res.status(200).json({ message: 'Day cycle updated successfully', data });
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('Supabase Daycycle API Error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};