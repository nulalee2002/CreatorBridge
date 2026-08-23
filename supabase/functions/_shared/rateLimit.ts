import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkDistributedRateLimit } from './distributedRateLimit.ts';

export interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
  action?: string;
  failClosed?: boolean;
}

function requestSubject(req: Request): string {
  const ip =
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (ip) return `ip:${ip}`;

  const authorization = req.headers.get('authorization')?.trim();
  if (authorization) return `authorization:${authorization}`;
  return '';
}

function actionFor(req: Request, configured?: string): string {
  if (configured) return configured;
  try {
    return new URL(req.url).pathname.split('/').filter(Boolean).pop() || 'edge-function';
  } catch {
    return 'edge-function';
  }
}

function jsonResponse(status: number, retryAfterSeconds: number, error: string) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(Math.max(1, retryAfterSeconds)),
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function checkRateLimit(
  req: Request,
  options: RateLimitOptions = { maxRequests: 20, windowMs: 60_000 },
): Promise<Response | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  const subject = requestSubject(req);
  if (!supabaseUrl || !serviceRoleKey || !subject) {
    return options.failClosed
      ? jsonResponse(503, 60, 'Request protection is temporarily unavailable. Please try again shortly.')
      : null;
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const result = await checkDistributedRateLimit(admin, {
    action: actionFor(req, options.action),
    subject,
    limit: options.maxRequests,
    windowSeconds: Math.max(1, Math.ceil(options.windowMs / 1000)),
    failClosed: options.failClosed,
  });

  if (result.allowed) return null;
  if (result.degraded) {
    return jsonResponse(503, result.retryAfterSeconds, 'Request protection is temporarily unavailable. Please try again shortly.');
  }
  return jsonResponse(429, result.retryAfterSeconds, 'Too many requests. Please slow down.');
}
