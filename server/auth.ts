import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { findUserById, DbUser } from './db';
import dotenv from 'dotenv';

dotenv.config();

// Typed as string so closures (jwt.sign/verify) see a narrowed secret; the falsy guard below still fails fast at boot.
const JWT_SECRET: string = process.env.JWT_SECRET ?? '';
if (!JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is required. Please define a strong secret in your .env or host dashboard.');
}

if (JWT_SECRET.length < 32 && process.env.NODE_ENV === 'production') {
  throw new Error('FATAL: JWT_SECRET must be at least 32 characters long for production security.');
}

// Separate secret for admin sessions so a leaked user JWT cannot forge admin access (and vice versa)
const JWT_ADMIN_SECRET = process.env.JWT_ADMIN_SECRET || `${JWT_SECRET}::admin`;
if (!process.env.JWT_ADMIN_SECRET && process.env.NODE_ENV === 'production') {
  console.warn('⚠️ JWT_ADMIN_SECRET not set — derived from JWT_SECRET. Set a dedicated JWT_ADMIN_SECRET in production.');
}

const JWT_EXPIRES_IN = '7d';
const JWT_ADMIN_EXPIRES_IN = '7d'; // aligned with admin cookie maxAge (7d)

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Constant-time string comparison to prevent timing attacks on admin login.
 * Falls back to false on length mismatch without leaking prefix info.
 */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Admin password verification: bcrypt compare when ADMIN_PASSWORD_HASH is set,
 * otherwise constant-time comparison of the plaintext secret.
 * Fail-closed: if neither a bcrypt hash nor a plaintext secret is configured,
 * the candidate is rejected (never compared against the string "undefined").
 */
export async function compareAdminPassword(candidate: string, plainSecret?: string, bcryptHash?: string): Promise<boolean> {
  if (bcryptHash && bcryptHash.startsWith('$2')) {
    try {
      return await bcrypt.compare(candidate, bcryptHash);
    } catch {
      return false;
    }
  }
  if (!plainSecret) {
    return false;
  }
  return safeEqual(candidate, plainSecret);
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
  if (req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)token=([^;]+)/);
    if (match) {
      return decodeURIComponent(match[1]);
    }
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

export interface AdminRequest extends Request {
  admin?: {
    username: string;
    role: 'admin';
  };
}

export function generateAdminToken(username: string): string {
  return jwt.sign(
    { username, role: 'admin' },
    JWT_ADMIN_SECRET as string,
    { expiresIn: JWT_ADMIN_EXPIRES_IN }
  );
}

export function extractAdminToken(req: Request): string | null {
  if (req.cookies && req.cookies.admin_token) {
    return req.cookies.admin_token;
  }
  if (req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)admin_token=([^;]+)/);
    if (match) {
      return decodeURIComponent(match[1]);
    }
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  return null;
}

export function requireAdminAuth(req: AdminRequest, res: Response, next: NextFunction): void {
  const token = extractAdminToken(req);
  if (!token) {
    res.status(401).json({ error: 'Admin huquqi talab qilinadi (Token topilmadi)' });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_ADMIN_SECRET as string) as { username: string; role: string };
    if (payload.role !== 'admin') {
      res.status(403).json({ error: 'Ruxsat berilmagan: faqat admin uchun' });
      return;
    }
    req.admin = {
      username: payload.username,
      role: 'admin'
    };
    next();
  } catch {
    res.status(401).json({ error: 'Admin seansi yaroqsiz yoki muddati tugagan' });
  }
}
