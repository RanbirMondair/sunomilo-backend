const jwt = require('jsonwebtoken');

// Generate JWT token
const generateToken = (userId, email) => {
  return jwt.sign(
    { userId, email },
    process.env.JWT_SECRET || 'sunomilo_jwt_secret_key_12345',
    { expiresIn: '30d' }
  );
};

// Verify JWT token middleware
const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'sunomilo_jwt_secret_key_12345'
    );
    
    req.userId = decoded.userId;
    req.email = decoded.email;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = { generateToken, authMiddleware };
