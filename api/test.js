module.exports = async (req, res) => {
  res.status(200).json({ 
    message: 'Vercel deployment is working!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    mongodb_uri_set: !!process.env.MONGODB_URI,
    api_key_set: !!process.env.API_KEY
  });
};
