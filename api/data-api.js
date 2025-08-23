const fetch = require('node-fetch');

module.exports = async (req, res) => {
  const MONGODB_DATA_API_URL = process.env.MONGODB_DATA_API_URL;
  const MONGODB_API_KEY = process.env.MONGODB_API_KEY;
  
  if (!MONGODB_DATA_API_URL || !MONGODB_API_KEY) {
    return res.status(500).json({ 
      error: 'MongoDB Data API not configured',
      missing: {
        data_api_url: !MONGODB_DATA_API_URL,
        api_key: !MONGODB_API_KEY
      }
    });
  }

  try {
    // Get daycycle data
    const daycycleResponse = await fetch(`${MONGODB_DATA_API_URL}/findOne`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': MONGODB_API_KEY,
      },
      body: JSON.stringify({
        dataSource: 'MenuDayCluster',
        database: 'schooltimer',
        collection: 'daycycles',
        filter: { _id: 'current' }
      })
    });

    // Get foodmenu data
    const foodmenuResponse = await fetch(`${MONGODB_DATA_API_URL}/findOne`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': MONGODB_API_KEY,
      },
      body: JSON.stringify({
        dataSource: 'MenuDayCluster',
        database: 'schooltimer',
        collection: 'foodmenus',
        filter: { _id: 'current' }
      })
    });

    const daycycle = await daycycleResponse.json();
    const foodmenu = await foodmenuResponse.json();

    res.status(200).json({
      daycycle: daycycle.document || { today: 'N/A', tomorrow: 'N/A', nextDay: 'N/A' },
      foodmenu: foodmenu.document || { breakfast: [], lunch: [] },
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('MongoDB Data API Error:', err);
    res.status(500).json({ 
      error: 'Data API error', 
      details: err.message,
      timestamp: new Date().toISOString()
    });
  }
};
