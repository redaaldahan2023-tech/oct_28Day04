import jwt from "jsonwebtoken";
import { getUserById } from "./services/userService.js";

// Stateless JWT bearer auth: works on Vercel's serverless functions and with Swagger's Authorize button.

export function authConfigured() {
  return Boolean(process.env.JWT_SECRET);
}

function secret() {
  if (!authConfigured()) {
    const err = new Error("JWT_SECRET is not set in backend/.env");
    err.status = 503;
    throw err;
  }
  return process.env.JWT_SECRET;
}

export function signToken(user) {
  return jwt.sign({ sub: String(user.user_id), role: user.role }, secret(), {
    algorithm: "HS256",
    expiresIn: process.env.JWT_EXPIRES_IN || "8h",
  });
}

function unauthorized() {
  const err = new Error("Authentication required");
  err.status = 401;
  return err;
}

export function issueSession(user) {
  return { user, token: signToken(user) };
}

// Verifies the bearer token and re-reads the user on every request, so a deleted account loses
// access immediately and a role change applies to existing tokens. req.user.role must always
// come from this query, never from the token payload.
export async function requireAuth(req, _res, next) {
  try {
    const [scheme, token] = (req.headers.authorization ?? "").split(" ");
    if (scheme !== "Bearer" || !token) throw unauthorized();

    let payload;
    try {
      payload = jwt.verify(token, secret(), { algorithms: ["HS256"] });
    } catch {
      throw unauthorized();
    }

    const user = await getUserById(Number(payload.sub));
    if (!user) throw unauthorized();
    req.user = { id: user.user_id, name: user.name, email: user.email, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
}

// Use after requireAuth.
export function requireRole(role) {
  return (req, _res, next) => {
    if (req.user?.role === role) return next();
    const err = new Error("Forbidden");
    err.status = 403;
    next(err);
  };
}

// Auth endpoints fail early with 503 instead of doing work they can't issue a token for.
export function requireAuthConfigured(_req, _res, next) {
  if (authConfigured()) return next();
  const err = new Error("JWT_SECRET is not set in backend/.env");
  err.status = 503;
  next(err);
}
