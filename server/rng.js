// Server-only RNG. Uses Node's crypto CSPRNG (crypto.randomInt is rejection-
// sampled, so it is unbiased across 1-6, unlike `Math.random()*6|0`).
// Never expose this module to the client — the whole point of moving rolls
// server-side is that the client cannot see or influence the entropy source.
const crypto = require('crypto');
const { DIE_MIN, DIE_MAX } = require('../lib/gameLogic');

function rollDie() {
    return crypto.randomInt(DIE_MIN, DIE_MAX + 1); // randomInt max is exclusive
}

module.exports = { rollDie };
