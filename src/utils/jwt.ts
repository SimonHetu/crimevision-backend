import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";

export type AccessTokenPayload = {
  sub: string;
  email?: string;
  role?: string;
};

const secretFromEnv = process.env.JWT_SECRET;
if (!secretFromEnv) throw new Error("Missing JWT_SECRET");
const JWT_SECRET = secretFromEnv;

const EXPIRES_IN: NonNullable<SignOptions["expiresIn"]> =
  (process.env.JWT_EXPIRES_IN as NonNullable<SignOptions["expiresIn"]>) ?? "1h";

export function signAccessToken(payload: AccessTokenPayload) {
  const options: SignOptions = { expiresIn: EXPIRES_IN };
  return jwt.sign(payload, JWT_SECRET, options);
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as JwtPayload & AccessTokenPayload;
}
