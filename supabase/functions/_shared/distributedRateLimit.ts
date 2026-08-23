export interface RateLimitAdmin {
  rpc: (
    functionName: string,
    params: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
}

export interface DistributedRateLimitOptions {
  action: string;
  subject: string;
  limit: number;
  windowSeconds: number;
  failClosed?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  degraded?: boolean;
}

function unavailableResult(options: DistributedRateLimitOptions): RateLimitResult {
  return options.failClosed
    ? { allowed: false, remaining: 0, retryAfterSeconds: 60, degraded: true }
    : { allowed: true, remaining: Math.max(0, options.limit - 1), retryAfterSeconds: 0, degraded: true };
}

async function hashSubject(subject: string, secret: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${secret}:${subject}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function checkDistributedRateLimit(
  admin: RateLimitAdmin,
  options: DistributedRateLimitOptions,
): Promise<RateLimitResult> {
  const secret = Deno.env.get('RATE_LIMIT_HASH_SECRET')?.trim();
  if (!secret || secret.length < 32 || !options.subject) return unavailableResult(options);

  const subjectHash = await hashSubject(options.subject, secret);
  try {
    const { data, error } = await admin.rpc('consume_edge_rate_limit', {
      p_action_key: options.action.slice(0, 120),
      p_subject_hash: subjectHash,
      p_limit_count: Math.max(1, Math.trunc(options.limit)),
      p_window_seconds: Math.max(1, Math.trunc(options.windowSeconds)),
    });
    if (error) {
      console.error('Distributed rate-limit check failed', { action: options.action, message: error.message || 'unknown' });
      return unavailableResult(options);
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row !== 'object') return unavailableResult(options);
    const value = row as Record<string, unknown>;
    return {
      allowed: value.allowed === true,
      remaining: Math.max(0, Number(value.remaining || 0)),
      retryAfterSeconds: Math.max(0, Number(value.retry_after_seconds || 0)),
    };
  } catch (error) {
    console.error('Distributed rate-limit service unavailable', {
      action: options.action,
      message: error instanceof Error ? error.message : 'unknown',
    });
    return unavailableResult(options);
  }
}
