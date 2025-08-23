const { MongoClient } = require('mongodb');

module.exports = async (req, res) => {
  const debugInfo = {
    timestamp: new Date().toISOString(),
    mongodb_uri_length: process.env.MONGODB_URI ? process.env.MONGODB_URI.length : 0,
    mongodb_uri_start: process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0, 20) + '...' : 'not set',
    step: 'starting'
  };

  try {
    debugInfo.step = 'creating client';
    const client = new MongoClient(process.env.MONGODB_URI);
    
    debugInfo.step = 'connecting to mongodb';
    await client.connect();
    debugInfo.step = 'connected successfully';
    
    debugInfo.step = 'accessing database';
    const db = client.db('schooltimer');
    debugInfo.step = 'database accessed';
    
    debugInfo.step = 'listing collections';
    const collections = await db.listCollections().toArray();
    debugInfo.collections = collections.map(c => c.name);
    debugInfo.step = 'collections listed';
    
    debugInfo.step = 'querying daycycles';
    const daycycle = await db.collection('daycycles').findOne({ _id: 'current' });
    debugInfo.daycycle_found = !!daycycle;
    debugInfo.step = 'daycycle queried';
    
    debugInfo.step = 'querying foodmenus';
    const foodmenu = await db.collection('foodmenus').findOne({ _id: 'current' });
    debugInfo.foodmenu_found = !!foodmenu;
    debugInfo.step = 'foodmenu queried';
    
    debugInfo.step = 'closing connection';
    await client.close();
    debugInfo.step = 'completed successfully';
    
    res.status(200).json(debugInfo);
    
  } catch (err) {
    debugInfo.step = 'error occurred';
    debugInfo.error = err.message;
    debugInfo.error_type = err.constructor.name;
    debugInfo.error_stack = err.stack;
    
    console.error('Debug endpoint error:', err);
    res.status(500).json(debugInfo);
  }
};
