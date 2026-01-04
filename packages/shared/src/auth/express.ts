import { NextFunction, Request, Response } from "express";
import { jwtVerify, importSPKI } from "jose";

// We assume these are available in global process.env or injected
const PUBLIC_KEY_B64 = process.env.AUTH_PUBLIC_KEY;

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  status: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

let publicKey: any = null;

async function getPublicKey() {
  if (publicKey) return publicKey;
  if (!PUBLIC_KEY_B64) {
     // If env is missing, we can't verify. Fail safe.
     return null;
  }
  const keyContent = Buffer.from(PUBLIC_KEY_B64, "base64").toString("utf-8");
  publicKey = await importSPKI(keyContent, "RS256");
  return publicKey;
}

/**
 * Verify JWT token
 */
export async function verifyToken(token: string): Promise<{ valid: boolean; user: AuthUser | null }> {
  try {
    const pub = await getPublicKey();
    if (!pub) return { valid: false, user: null };
    const { payload } = await jwtVerify(token, pub);
    return { valid: true, user: {
        id: payload.sub as string,
        email: payload.email as string,
        role: payload.role as string,
        status: payload.status as string,
      } as AuthUser };
  } catch (e) {
    return { valid: false, user: null };
  }
}

/**
 * Extracts session from Authorization Header (Bearer Token)
 */
export async function getSession(req: Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.split(" ")[1];
  if (!token) return null; // Guard against undefined

  try {
    const pub = await getPublicKey();
    if (!pub) return null;

    const { payload } = await jwtVerify(token, pub);
    return {
      user: {
        id: payload.sub as string,
        email: payload.email as string,
        role: payload.role as string,
        status: payload.status as string,
      } as AuthUser
    };
  } catch (e) {
    return null;
  }
}

/**
 * Express Middleware to populate res.locals.session and req.user
 */
export async function authSession(req: Request, res: Response, next: NextFunction) {
  const session = await getSession(req);
  
  if (session) {
    req.user = session.user;
    res.locals.session = session;
  }
  
  next();
}

/**
 * Guard Middleware - blocks request if not authenticated
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
    const session = await getSession(req);
    if (!session) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    req.user = session.user;
    res.locals.session = session;
    next();
}
