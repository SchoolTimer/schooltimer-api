const { exec } = require('child_process');
const { promisify } = require('util');
const execPromise = promisify(exec);

module.exports = async (req, res) => {
  if (req.headers['user-agent'] !== 'vercel-cron/1.0') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const { stdout, stderr } = await execPromise('python3 scrapers/daycycle.py');
    console.log('daycycle.py output:', stdout);
    if (stderr) console.error('daycycle.py error:', stderr);
    res.status(200).json({ message: 'Day cycle scraper triggered' });
  } catch (error) {
    console.error('Error executing daycycle.py:', error);
    res.status(500).json({ error: 'Failed to trigger day cycle scraper' });
  }
};