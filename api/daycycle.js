const { MongoClient } = require('mongodb');

module.exports = async (req, res) => {
  const client = new MongoClient(process.env.MONGODB_URI);
  const apiKey = req.headers['api-key'];

  try {
    await client.connect();
    const db = client.db('schooltimer');
    if (req.method === 'GET') {
      const data = await db.collection('daycycles').findOne({ _id: 'current' }) || { today: 'N/A', tomorrow: 'N/A', nextDay: 'N/A' };
      res.status(200).json(data);
    } else if (req.method === 'POST' && apiKey === process.env.API_KEY) {
      const { today, tomorrow, nextDay } = req.body;
      if (!today || !tomorrow || !nextDay) return res.status(400).json({ error: 'Missing fields' });
      await db.collection('daycycles').updateOne(
        { _id: 'current' },
        { $set: { today, tomorrow, nextDay } },
        { upsert: true }
      );
      res.status(200).json({ message: 'Day cycle updated' });
    } else {
      res.status(403).json({ error: 'Invalid API key' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  } finally {
    await client.close();
  }
};