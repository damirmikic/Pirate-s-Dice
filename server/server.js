// Authoritative game server. Bet validation, RNG, scoring, and payout all
// happen here — the client only ever renders what this server tells it.
// This closes the "edit game.balance in devtools" hole from the prototype:
// the client no longer holds any state that matters.
const express = require('express');
const path = require('path');

const { computeScore, determineWinner, resolvePayout, WIN_PAYOUT_MULTIPLIER } = require('../lib/gameLogic');
const { rollDie } = require('./rng');
const { getSession, STARTING_BALANCE } = require('./sessionStore');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..'), { index: 'index.html' }));

app.get('/api/state', (req, res) => {
    const session = getSession(req, res);
    res.json({ balance: session.balance, payoutMultiplier: WIN_PAYOUT_MULTIPLIER });
});

app.post('/api/bet', (req, res) => {
    const session = getSession(req, res);
    const amount = Number(req.body && req.body.amount);

    if (!Number.isInteger(amount) || amount <= 0) {
        return res.status(400).json({ error: 'Bet must be a positive whole number.' });
    }
    if (amount > session.balance) {
        return res.status(400).json({ error: 'Bet exceeds available balance.' });
    }

    // Deduct up front; only a winning or push outcome pays anything back.
    session.balance -= amount;

    const playerRolls = [rollDie(), rollDie()];
    const opponentRolls = [rollDie(), rollDie()];
    const playerScore = computeScore(playerRolls);
    const opponentScore = computeScore(opponentRolls);
    const winner = determineWinner(playerScore, opponentScore);
    const winnings = resolvePayout(amount, winner);

    session.balance += winnings;

    res.json({
        bet: amount,
        playerRolls,
        opponentRolls,
        playerScore,
        opponentScore,
        winner,
        winnings,
        balance: session.balance,
    });
});

// Demo-only faucet so the prototype doesn't dead-end at zero balance.
// A real build replaces this with an actual deposit flow — see audit
// roadmap item 4 (accounts/ledger). Must not ship as-is.
app.post('/api/demo-refill', (req, res) => {
    const session = getSession(req, res);
    if (session.balance > 0) {
        return res.status(400).json({ error: 'Refill is only available when bankrupt.' });
    }
    session.balance = STARTING_BALANCE;
    res.json({ balance: session.balance });
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Pirate's Dice Duel server listening on http://localhost:${PORT}`);
    });
}

module.exports = app;
