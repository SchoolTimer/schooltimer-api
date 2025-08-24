const { exec } = require('child_process');
const { promisify } = require('util');
const execPromise = promisify(exec);

module.exports = async (req, res) => {
  try {
    const { stdout, stderr } = await execPromise('node scrapers/foodmenu.js');
    console.log('foodmenu.js output:', stdout);
    if (stderr) console.error('foodmenu.js error:', stderr);
    res.status(200).json({ message: 'Food menu scraper triggered' });
  } catch (error) {
    console.error('Error executing foodmenu.js:', error);
    res.status(500).json({ error: 'Failed to trigger food menu scraper' });
  }
};