import { Request, Response, NextFunction } from 'express';

const SENSITIVE_KEYS = new Set([
    'password', 'confirm_password', 'new_password', 'old_password',
    'token', 'access_token', 'refresh_token', 'authorization',
    'bvn', 'dob', 'beneficiary_account',
    'emailVerificationKey', 'passwordResetKey',
    'secret', 'api_key', 'apikey',
]);

function redact(obj: any, depth = 0): any {
    if (depth > 4 || obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.slice(0, 10).map(i => redact(i, depth + 1));

    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
        out[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : redact(v, depth + 1);
    }
    return out;
}

function colorStatus(status: number): string {
    if (status >= 500) return `\x1b[31m${status}\x1b[0m`; // red
    if (status >= 400) return `\x1b[33m${status}\x1b[0m`; // yellow
    if (status >= 300) return `\x1b[36m${status}\x1b[0m`; // cyan
    return `\x1b[32m${status}\x1b[0m`;                     // green
}

function colorMethod(method: string): string {
    const colors: Record<string, string> = {
        GET:    '\x1b[34m',
        POST:   '\x1b[32m',
        PUT:    '\x1b[33m',
        PATCH:  '\x1b[33m',
        DELETE: '\x1b[31m',
    };
    return `${colors[method] ?? ''}${method}\x1b[0m`;
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
    // Skip OPTIONS preflight and health checks
    if (req.method === 'OPTIONS' || req.path === '/_readiness' || req.path.endsWith('/_healthcheck')) {
        return next();
    }

    const startAt = process.hrtime.bigint();
    const ts = new Date().toISOString();

    // Collect request body snapshot before it can be consumed
    const body = Object.keys(req.body ?? {}).length > 0 ? redact(req.body) : undefined;
    const query = Object.keys(req.query ?? {}).length > 0 ? req.query : undefined;

    res.on('finish', () => {
        const durationMs = Number(process.hrtime.bigint() - startAt) / 1_000_000;
        const userId = (req as any).user?.id ?? (req as any).user?.dataValues?.id;

        const parts = [
            `\x1b[2m${ts}\x1b[0m`,
            colorMethod(req.method),
            req.path,
            colorStatus(res.statusCode),
            `${durationMs.toFixed(1)}ms`,
        ];
        if (userId) parts.push(`user:${userId.slice(0, 8)}`);

        console.log(parts.join('  '));

        if (body) {
            console.log('  \x1b[2m→ body\x1b[0m', JSON.stringify(body));
        }
        if (query) {
            console.log('  \x1b[2m→ query\x1b[0m', JSON.stringify(query));
        }
    });

    next();
}

export function errorLogger(err: any, req: Request, res: Response, next: NextFunction): void {
    const ts = new Date().toISOString();
    const userId = (req as any).user?.id ?? (req as any).user?.dataValues?.id;

    console.error(
        `\x1b[2m${ts}\x1b[0m  \x1b[31mERROR\x1b[0m  ${colorMethod(req.method)}  ${req.path}${userId ? `  user:${userId.slice(0, 8)}` : ''}`
    );
    console.error('  message:', err?.message ?? String(err));
    if (err?.stack) {
        const stackLines = err.stack.split('\n').slice(1, 4).map((l: string) => `    ${l.trim()}`).join('\n');
        console.error(stackLines);
    }

    next(err);
}
