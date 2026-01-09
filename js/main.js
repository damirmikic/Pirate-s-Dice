// Configuration
const ROUND_DURATION_MS = 30000; // 30 seconds
const ANIMATION_DURATION_MS = 3000;
const RESULT_DISPLAY_DURATION_MS = 3000;

const OPPONENTS = [
    { name: "Davy Jones", avatar: "assets/avatar_opponent.png" },
    { name: "Calico Jack", avatar: "assets/avatar_brute.png" },
    { name: "Anne Bonny", avatar: "assets/avatar_female.png" },
    { name: "Ghost Captain", avatar: "assets/avatar_ghost.png" }
];

// State
const game = new Game(); // Instantiate the Game logic
let gameState = 'BETTING'; // BETTING, ROLLING, RESULT
let timeRemaining = ROUND_DURATION_MS;
let timerInterval = null;
let currentOpponent = OPPONENTS[0];

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
// Fallback if IDs missing in HTML (safeguard)
const actualOpponentDiceEls = [
    opponentDiceEls[0] || document.querySelector('#opponent-dice-container .die:nth-child(1)'),
    opponentDiceEls[1] || document.querySelector('#opponent-dice-container .die:nth-child(2)')
];


// Chip Buttons
document.querySelectorAll('.chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (gameState !== 'BETTING') return;

        const val = btn.dataset.value;
        if (val === 'max') {
            betInput.value = game.balance;
        } else {
            const currentBet = parseInt(betInput.value) || 0;
            const newBet = currentBet + parseInt(val);
            if (newBet <= game.balance) {
                betInput.value = newBet;
            } else {
                betInput.value = game.balance; // Cap at max balance
                logMessage("Max bet reached!", "normal");
            }
        }
    });
});

function updateUI() {
    balanceDisplay.textContent = game.balance;
}

function setDiceFace(element, value) {
    if (!element) return;

    // Clear previous pips/text
    element.textContent = '';
    element.dataset.value = value;

    // Create correct number of pips
    const dotCount = parseInt(value) || 0;
    for (let i = 0; i < dotCount; i++) {
        const pip = document.createElement('div');
        pip.className = 'pip';
        element.appendChild(pip);
    }
}

function logMessage(msg, type) {
    messageLog.textContent = msg;
    if (type === 'error') messageLog.style.color = 'var(--color-ink-red)'; // dark red for parchment
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

    // 1. Validate Bet
    const bet = parseInt(betInput.value);

    // Auto-fix bet if invalid
    let validBet = bet;
    if (isNaN(bet) || bet <= 0) validBet = 10;
    if (bet > game.balance) validBet = game.balance; // All in if bet exceeds balance

    if (game.balance <= 0) {
        logMessage("Ye be bankrupt! Resetting balance...", "error");
        game.balance = 1000;
        updateUI();
        return;
    }

    betInput.value = validBet;

    // 2. Start Rolling Phase
    gameState = 'ROLLING';
    setControlsEnabled(false);
    logMessage("Rolling the bones...", "normal");
    gameResultBadge.classList.add('hidden');

    try {
        game.placeBet(validBet);
        updateUI();

        // Animation
        const allDice = [...playerDiceEls, ...actualOpponentDiceEls];
        allDice.forEach(el => el.classList.add('rolling'));

        await new Promise(r => setTimeout(r, ANIMATION_DURATION_MS));

        // Logic
        const rollResult = game.rollAll();
        allDice.forEach(el => el.classList.remove('rolling'));

        // Update Faces
        setDiceFace(playerDiceEls[0], rollResult.player[0]);
        setDiceFace(playerDiceEls[1], rollResult.player[1]);
        setDiceFace(actualOpponentDiceEls[0], rollResult.opponent[0]);
        setDiceFace(actualOpponentDiceEls[1], rollResult.opponent[1]);

        // Scoring
        const pScore = game.getScore(rollResult.player);
        const oScore = game.getScore(rollResult.opponent);

        playerScoreEl.textContent = pScore;
        opponentScoreEl.textContent = oScore;

        const winner = game.determineWinner(pScore, oScore);
        const winnings = game.resolveRound(validBet, winner);

        updateUI();

        // Result Messaging
        gameState = 'RESULT';
        if (winner === 'player') {
            logMessage(`You won ${winnings} doubloons!`, "success");
            gameResultBadge.textContent = "WINNER!";
            gameResultBadge.style.color = "var(--color-success)";
            gameResultBadge.classList.remove('hidden');
        } else if (winner === 'opponent') {
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
        logMessage(e.message, "error");
    }

    // Wait for result display
    await new Promise(r => setTimeout(r, RESULT_DISPLAY_DURATION_MS));

    // Choose new opponent for next round
    pickNewOpponent();

    // Reset for next round
    startBettingPhase();
}

function pickNewOpponent() {
    const idx = Math.floor(Math.random() * OPPONENTS.length);
    currentOpponent = OPPONENTS[idx];

    // Update UI
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

    // Reset Dice (optional visual reset)
    // could set them to '?'
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

        // Update Timer UI
        const pct = (timeRemaining / ROUND_DURATION_MS) * 100;
        timerBar.style.width = `${pct}%`;
        timerText.textContent = `${Math.ceil(timeRemaining / 1000)}s`;
    }

    requestAnimationFrame(gameLoop);
}

// Init
let lastTime = Date.now();
startBettingPhase();
gameLoop();

updateUI();
setDiceFace(playerDiceEls[0], 1);
setDiceFace(playerDiceEls[1], 1);
setDiceFace(actualOpponentDiceEls[0], 1);
setDiceFace(actualOpponentDiceEls[1], 1);
