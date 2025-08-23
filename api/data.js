const { MongoClient } = require('mongodb');

module.exports = async (req, res) => {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('schooltimer');
    const daycycle = await db.collection('daycycles').findOne({ _id: 'current' }) || { today: 'N/A', tomorrow: 'N/A', nextDay: 'N/A' };
    const foodmenu = await db.collection('foodmenus').findOne({ _id: 'current' }) || { breakfast: [], lunch: [] };
    res.status(200).json({ daycycle, foodmenu });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  } finally {
    await client.close();
  }
};