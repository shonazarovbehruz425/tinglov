import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { findUserById, DbUser } from './db';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is required. Please define a strong secret in your .env or host dashboard.');
}

if (JWT_SECRET.length < 32 && process.env.NODE_ENV === 'production') {
  throw new Error('FATAL: JWT_SECRET must be at least 32 characters long for production security.');
}

const JWT_EXPIRES_IN = '7d';

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

export function extractToken(req: Request): string | null {
  // 1. Check HttpOnly cookie first
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  // 2. Fallback to Bearer token in Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  return null;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Avtorizatsiyadan o‘tish talab etiladi (Token topilmadi)' });
    return;
  }

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
  const token = extractToken(req);
  if (token) {
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
