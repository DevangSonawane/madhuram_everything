import jwt from 'jsonwebtoken';

export const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    const userRole = req.user?.role;
    if (!userRole) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ message: 'Forbidden: insufficient permissions' });
    }

    return next();
  };
};
