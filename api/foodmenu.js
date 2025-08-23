const { MongoClient } = require('mongodb');

module.exports = async (req, res) => {
  const client = new MongoClient(process.env.MONGODB_URI);
  const apiKey = req.headers['api-key'];

  try {
    await client.connect();
    const db = client.db('schooltimer');
    if (req.method === 'GET') {
      const data = await db.collection('foodmenus').findOne({ _id: 'current' }) || { breakfast: [], lunch: [] };
      res.status(200).json(data);
    } else if (req.method === 'POST' && apiKey === process.env.API_KEY) {
      const { breakfast, lunch } = req.body;
      if (!Array.isArray(breakfast) || !Array.isArray(lunch)) return res.status(400).json({ error: 'Invalid data' });
      await db.collection('foodmenus').updateOne(
        { _id: 'current' },
        { $set: { breakfast, lunch } },
        { upsert: true }
      );
      res.status(200).json({ message: 'Food menu updated' });
    } else {
      res.status(403).json({ error: 'Invalid API key' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  } finally {
    await client.close();
  }
};