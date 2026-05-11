import { sign as honoSign, verify as honoVerify } from 'hono/jwt'

export interface JwtPayload {
  sub: string
  name: string
  iat?: number
  exp?: number
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET environment variable is not set')
  return secret
}

export async function sign(payload: Omit<JwtPayload, 'iat' | 'exp'>): Promise<string> {
  const secret = getSecret()
  const now = Math.floor(Date.now() / 1000)
  return honoSign({ ...payload, iat: now, exp: now + 60 * 60 * 24 }, secret)
}

export async function verify(token: string): Promise<JwtPayload> {
  const secret = getSecret()
  const payload = await honoVerify(token, secret, 'HS256')
  return payload as JwtPayload
}
