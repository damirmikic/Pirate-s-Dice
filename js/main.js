// Client is a pure renderer: it never computes a balance, a roll, or a
// winner itself. Every bet goes to the server (server/server.js), which owns
// the RNG, the balance, and the payout math. This file only sends requests
// and displays whatever the server returns.

const ANIMATION_DURATION_MS = 3000;
const RESULT_DISPLAY_DURATION_MS = 3000;
const ROUND_DURATION_MS = 30000; // 30 seconds

const OPPONENTS = [
    { name: "Davy Jones", avatar: "assets/avatar_opponent.png" },
    { name: "Calico Jack", avatar: "assets/avatar_brute.png" },
    { name: "Anne Bonny", avatar: "assets/avatar_female.png" },
    { name: "Ghost Captain", avatar: "assets/avatar_ghost.png" }
];

// State
let balance = 0;
let payoutMultiplier = null;
let gameState = 'BETTING'; // BETTING, ROLLING, RESULT
let timeRemaining = ROUND_DURATION_MS;
let currentOpponent = OPPONENTS[0];
let lastTime = Date.now();

// DOM Elements
const balanceDisplay = document.getElementById('player-balance');
const betInput = document.getElementById('bet-amount');
const messageLog = document.getElementById('message-log');
const opponentScoreEl = document.getElementById('opponent-score');
const playerScoreEl = document.getElementById('player-score');
const gameResultBadge = document.getElementById('game-result-badge');

const timerBar = document.getElementById('timer-bar');
const timerText = document.getElementById('timer-text');
const betControls = document.querySelector('.betting-controls');
const payoutInfoEl = document.getElementById('payout-info');

const opponentAvatarEl = document.querySelector('.opponent .avatar-img');
const opponentNameEl = document.querySelector('.opponent .player-name');

const playerDiceEls = [
    document.getElementById('player-die-1'),
    document.getElementById('player-die-2')
];
const opponentDiceEls = [
    document.getElementById('opp-die-1'),
    document.getElementById('opp-die-2')
];

async function api(path, options) {
    const res = await fetch(path, {
        method: options && options.method || 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: options && options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed.');
    return data;
}

// Chip Buttons
document.querySelectorAll('.chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (gameState !== 'BETTING') return;

        const val = btn.dataset.value;
        if (val === 'max') {
            betInput.value = balance;
        } else {
            const currentBet = parseInt(betInput.value) || 0;
            const newBet = currentBet + parseInt(val);
            if (newBet <= balance) {
                betInput.value = newBet;
            } else {
                betInput.value = balance; // Cap at max balance
                logMessage("Max bet reached!", "normal");
            }
        }
    });
});

function updateUI() {
    balanceDisplay.textContent = balance;
    if (payoutInfoEl && payoutMultiplier) {
        payoutInfoEl.textContent = `Win pays ${payoutMultiplier}x`;
    }
}

function setDiceFace(element, value) {
    if (!element) return;

    element.textContent = '';
    element.dataset.value = value;

    const dotCount = parseInt(value) || 0;
    for (let i = 0; i < dotCount; i++) {
        const pip = document.createElement('div');
        pip.className = 'pip';
        element.appendChild(pip);
    }
}

function logMessage(msg, type) {
    messageLog.textContent = msg;
    if (type === 'error') messageLog.style.color = 'var(--color-ink-red)';
    else if (type === 'success') messageLog.style.color = 'var(--color-success)';
    else messageLog.style.color = 'var(--color-ink)';
}

function setControlsEnabled(enabled) {
    if (enabled) {
        betControls.style.opacity = '1';
        betControls.style.pointerEvents = 'all';
        betInput.disabled = false;
    } else {
        betControls.style.opacity = '0.5';
        betControls.style.pointerEvents = 'none';
        betInput.disabled = true;
    }
}

async function runGameRound() {
    if (gameState !== 'BETTING') return; // Guard clause against double-firing

    if (balance <= 0) {
        logMessage("Ye be bankrupt! Requesting a demo refill...", "error");
        try {
            const data = await api('/api/demo-refill', { method: 'POST' });
            balance = data.balance;
            updateUI();
        } catch (e) {
            logMessage(e.message, "error");
        }
        return;
    }

    const requestedBet = parseInt(betInput.value);
    if (isNaN(requestedBet) || requestedBet <= 0) {
        logMessage("Enter a valid wager before the bell tolls!", "error");
        return;
    }

    gameState = 'ROLLING';
    setControlsEnabled(false);
    logMessage("Rolling the bones...", "normal");
    gameResultBadge.classList.add('hidden');

    const allDice = [...playerDiceEls, ...opponentDiceEls];
    allDice.forEach(el => el.classList.add('rolling'));

    try {
        // Fire the authoritative request and hold the animation for at least
        // ANIMATION_DURATION_MS, whichever takes longer, so a fast server
        // response doesn't cut the roll animation short.
        const [data] = await Promise.all([
            api('/api/bet', { method: 'POST', body: { amount: requestedBet } }),
            new Promise(r => setTimeout(r, ANIMATION_DURATION_MS)),
        ]);

        allDice.forEach(el => el.classList.remove('rolling'));

        setDiceFace(playerDiceEls[0], data.playerRolls[0]);
        setDiceFace(playerDiceEls[1], data.playerRolls[1]);
        setDiceFace(opponentDiceEls[0], data.opponentRolls[0]);
        setDiceFace(opponentDiceEls[1], data.opponentRolls[1]);

        playerScoreEl.textContent = data.playerScore;
        opponentScoreEl.textContent = data.opponentScore;

        balance = data.balance;
        updateUI();

        gameState = 'RESULT';
        if (data.winner === 'player') {
            logMessage(`You won ${data.winnings} doubloons!`, "success");
            gameResultBadge.textContent = "WINNER!";
            gameResultBadge.style.color = "var(--color-success)";
            gameResultBadge.classList.remove('hidden');
        } else if (data.winner === 'opponent') {
            logMessage("The house wins this time...", "error");
            gameResultBadge.textContent = "DEFEAT";
            gameResultBadge.style.color = "var(--color-ink-red)";
            gameResultBadge.classList.remove('hidden');
        } else {
            logMessage("It's a tie! Push.", "normal");
            gameResultBadge.textContent = "PUSH";
            gameResultBadge.style.color = "var(--color-ink)";
            gameResultBadge.classList.remove('hidden');
        }
    } catch (e) {
        allDice.forEach(el => el.classList.remove('rolling'));
        logMessage(e.message, "error");
    }

    await new Promise(r => setTimeout(r, RESULT_DISPLAY_DURATION_MS));

    pickNewOpponent();
    startBettingPhase();
}

function pickNewOpponent() {
    const idx = Math.floor(Math.random() * OPPONENTS.length);
    currentOpponent = OPPONENTS[idx];

    if (opponentAvatarEl) opponentAvatarEl.src = currentOpponent.avatar;
    if (opponentNameEl) opponentNameEl.textContent = currentOpponent.name;

    logMessage(`A new challenger approaches: ${currentOpponent.name}!`, "normal");
}

function startBettingPhase() {
    gameState = 'BETTING';
    setControlsEnabled(true);
    logMessage("Place yer bets!", "normal");

    timeRemaining = ROUND_DURATION_MS;
    lastTime = Date.now();
}

function gameLoop() {
    if (gameState === 'BETTING') {
        const now = Date.now();
        const delta = now - lastTime;
        lastTime = now;

        timeRemaining -= delta;

        if (timeRemaining <= 0) {
            timeRemaining = 0;
            runGameRound();
        }

        const pct = (timeRemaining / ROUND_DURATION_MS) * 100;
        timerBar.style.width = `${pct}%`;
        timerText.textContent = `${Math.ceil(timeRemaining / 1000)}s`;
    }

    requestAnimationFrame(gameLoop);
}

async function init() {
    setDiceFace(playerDiceEls[0], 1);
    setDiceFace(playerDiceEls[1], 1);
    setDiceFace(opponentDiceEls[0], 1);
    setDiceFace(opponentDiceEls[1], 1);

    try {
        const data = await api('/api/state');
        balance = data.balance;
        payoutMultiplier = data.payoutMultiplier;
    } catch (e) {
        logMessage("Could not reach the captain's ledger. Refresh to try again.", "error");
    }

    updateUI();
    startBettingPhase();
    gameLoop();
}

init();
