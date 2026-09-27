// Minimal in-memory session store keyed by an httpOnly cookie.
// This is a placeholder for real accounts/auth (see audit roadmap item 4) —
// it exists only so balance has a single server-side owner instead of the
// client. Restarting the server resets all balances; that's acceptable for
// this stage but must not survive into a real-money build.
const crypto = require('crypto');

const STARTING_BALANCE = 1000;
const COOKIE_NAME = 'sid';

const sessions = new Map(); // sid -> { balance }

function parseCookies(header) {
    const cookies = {};
    if (!header) return cookies;
    header.split(';').forEach(pair => {
        const idx = pair.indexOf('=');
        if (idx === -1) return;
        const key = pair.slice(0, idx).trim();
        const value = pair.slice(idx + 1).trim();
        if (key) cookies[key] = decodeURIComponent(value);
    });
    return cookies;
}

// Reads the session cookie off the request, creating a fresh session (and
// setting a new cookie) if none exists yet or it doesn't match a live one.
function getSession(req, res) {
    const cookies = parseCookies(req.headers.cookie);
    let sid = cookies[COOKIE_NAME];

    if (!sid || !sessions.has(sid)) {
        sid = crypto.randomUUID();
        sessions.set(sid, { balance: STARTING_BALANCE });
        res.setHeader('Set-Cookie', `${COOKIE_NAME}=${sid}; HttpOnly; Path=/; SameSite=Strict`);
    }

    return sessions.get(sid);
}

module.exports = { getSession, STARTING_BALANCE };
