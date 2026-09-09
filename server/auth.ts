import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { findUserById, DbUser } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'tinglov_super_secure_jwt_secret_2026_x89f';
const JWT_EXPIRES_IN = '30d';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(user: { id: number; username: string; email: string }): string {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export interface AuthenticatedRequest extends Request {
  user?: DbUser;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Avtorizatsiyadan o‘tish talab etiladi (Token topilmadi)' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: number; username: string; email: string };
    const user = findUserById(payload.id);
    if (!user) {
      res.status(401).json({ error: 'Foydalanuvchi topilmadi' });
      return;
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Token yaroqsiz yoki muddati o‘tgan' });
  }
}

export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { id: number };
      const user = findUserById(payload.id);
      if (user) {
        req.user = user;
      }
    } catch {
      // Ignore invalid optional token
    }
  }
  next();
}
