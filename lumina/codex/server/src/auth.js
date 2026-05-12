import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'lumina-dev-secret';

export const signToken = (user) => jwt.sign({ sub: user.id, email: user.email }, SECRET, { expiresIn: '7d' });

export const authRequired = (req, res, next) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};
