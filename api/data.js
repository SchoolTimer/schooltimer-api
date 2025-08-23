const { MongoClient, ServerApiVersion } = require('mongodb');

module.exports = async (req, res) => {
  const client = new MongoClient(process.env.MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
  });
  try {
    await client.connect();
    const db = client.db('schooltimer');
    const daycycle = await db.collection('daycycles').findOne({ _id: 'current' }) || { today: 'N/A', tomorrow: 'N/A', nextDay: 'N/A' };
    const foodmenu = await db.collection('foodmenus').findOne({ _id: 'current' }) || { breakfast: [], lunch: [] };
    res.status(200).json({ daycycle, foodmenu });
  } catch (err) {
    console.error('MongoDB Error in /api/data:', err);
    res.status(500).json({ 
      error: 'Server error', 
      details: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
      timestamp: new Date().toISOString()
    });
  } finally {
    await client.close();
  }
};