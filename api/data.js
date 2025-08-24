const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
  try {
    // Get daycycle data
    const { data: daycycle, error: daycycleError } = await supabase
      .from('daycycles')
      .select('*')
      .eq('id', 'current')
      .single();

    if (daycycleError && daycycleError.code !== 'PGRST116') {
      console.error('Daycycle error:', daycycleError);
    }

    // Get foodmenu data
    const { data: foodmenu, error: foodmenuError } = await supabase
      .from('foodmenus')
      .select('*')
      .eq('id', 'current')
      .single();

    if (foodmenuError && foodmenuError.code !== 'PGRST116') {
      console.error('Foodmenu error:', foodmenuError);
    }

    res.status(200).json({
      daycycle: daycycle || { today: 'N/A', tomorrow: 'N/A', nextDay: 'N/A' },
      foodmenu: foodmenu || { breakfast: [], lunch: [] },
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('Supabase API Error:', err);
    res.status(500).json({ 
      error: 'Database error', 
      details: err.message,
      timestamp: new Date().toISOString()
    });
  }
};
