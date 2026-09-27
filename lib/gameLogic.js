// Pure, deterministic game math — no RNG here. RNG lives server-side only
// (server/rng.js) so it can be secured, seeded/audited, and kept out of
// client reach. This module is required by the server and by the test suite.

const DIE_MIN = 1;
const DIE_MAX = 6;

// Win payout multiplier. Ties push (bet returned), losses forfeit the bet.
// Because the sum of two dice is symmetric, P(player > opponent) ==
// P(opponent > player), so a 2x win payout with a push on ties is a fair
// (100% RTP) game — see theoreticalRTP(). 1.9x gives the house an edge
// while ties still push, matching the target below.
const WIN_PAYOUT_MULTIPLIER = 1.9;

// Target RTP this multiplier is tuned for. Verified exactly by
// theoreticalRTP() and pinned by test/gameLogic.test.js.
const TARGET_RTP = 0.9556;

function computeScore(rolls) {
    return rolls.reduce((a, b) => a + b, 0);
}

// Returns 'player', 'opponent', or 'tie'.
function determineWinner(playerScore, opponentScore) {
    if (playerScore > opponentScore) return 'player';
    if (opponentScore > playerScore) return 'opponent';
    return 'tie';
}

// Returns the amount credited back to the player's balance (not the net
// profit). The bet itself must already have been deducted by the caller
// before resolving, so: win -> bet * multiplier, tie -> bet (push),
// loss -> 0.
function resolvePayout(betAmount, winner, payoutMultiplier = WIN_PAYOUT_MULTIPLIER) {
    if (winner === 'player') return betAmount * payoutMultiplier;
    if (winner === 'tie') return betAmount;
    return 0;
}

// Exhaustively enumerates all 6^4 dice outcomes (exact, not sampled) and
// returns the theoretical RTP for a given payout multiplier. Used to prove
// the house edge rather than trust a hand-derived formula.
function theoreticalRTP(payoutMultiplier = WIN_PAYOUT_MULTIPLIER) {
    let totalNet = 0;
    let outcomes = 0;

    for (let p1 = DIE_MIN; p1 <= DIE_MAX; p1++) {
        for (let p2 = DIE_MIN; p2 <= DIE_MAX; p2++) {
            for (let o1 = DIE_MIN; o1 <= DIE_MAX; o1++) {
                for (let o2 = DIE_MIN; o2 <= DIE_MAX; o2++) {
                    const winner = determineWinner(p1 + p2, o1 + o2);
                    const returned = resolvePayout(1, winner, payoutMultiplier);
                    totalNet += (returned - 1); // net profit on a 1-unit bet
                    outcomes++;
                }
            }
        }
    }

    return 1 + (totalNet / outcomes);
}

module.exports = {
    DIE_MIN,
    DIE_MAX,
    WIN_PAYOUT_MULTIPLIER,
    TARGET_RTP,
    computeScore,
    determineWinner,
    resolvePayout,
    theoreticalRTP,
};
