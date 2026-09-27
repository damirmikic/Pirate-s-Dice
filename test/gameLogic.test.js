const test = require('node:test');
const assert = require('node:assert/strict');

const {
    computeScore,
    determineWinner,
    resolvePayout,
    theoreticalRTP,
    WIN_PAYOUT_MULTIPLIER,
    TARGET_RTP,
} = require('../lib/gameLogic');

test('computeScore sums dice', () => {
    assert.equal(computeScore([3, 4]), 7);
    assert.equal(computeScore([1, 1]), 2);
    assert.equal(computeScore([6, 6]), 12);
});

test('determineWinner picks the higher score, or tie', () => {
    assert.equal(determineWinner(8, 5), 'player');
    assert.equal(determineWinner(5, 8), 'opponent');
    assert.equal(determineWinner(7, 7), 'tie');
});

test('resolvePayout: win pays the multiplier, tie pushes, loss forfeits', () => {
    assert.equal(resolvePayout(10, 'player', 1.9), 19);
    assert.equal(resolvePayout(10, 'tie', 1.9), 10);
    assert.equal(resolvePayout(10, 'opponent', 1.9), 0);
});

test('regression guard: the old 2x-win/push-tie payout was a fair (100% RTP) game', () => {
    // This is the bug this change fixes. A 2x win payout with tie-pushes is
    // exactly break-even because P(player>opponent) == P(opponent>player).
    // Pinning it here so nobody "simplifies" the multiplier back to 2 without
    // noticing it erases the house edge.
    const fairRTP = theoreticalRTP(2);
    assert.ok(Math.abs(fairRTP - 1) < 1e-9, `expected old payout to be exactly fair, got RTP=${fairRTP}`);
});

test('current payout multiplier gives the house a real, bounded edge', () => {
    const rtp = theoreticalRTP(WIN_PAYOUT_MULTIPLIER);

    // Locked to the documented target (computed by exhaustive enumeration
    // over all 1296 dice outcomes, not sampled).
    assert.ok(Math.abs(rtp - TARGET_RTP) < 0.001, `RTP ${rtp} drifted from target ${TARGET_RTP}`);

    // Sanity bounds: some edge, but not a rip-off. Real table games commonly
    // sit in the 90-99% RTP range.
    assert.ok(rtp < 1, 'game must not be fair/beneficial to the player (RTP must be < 100%)');
    assert.ok(rtp > 0.90, 'house edge should not be excessive (RTP should stay above 90%)');
});

test('exhaustive enumeration matches the closed-form probabilities', () => {
    // P(tie) for two independent sums of 2d6 = sum(p_n^2) over n=2..12,
    // where p_n/36 is the standard 2d6 distribution. Cross-check the
    // brute-force RTP function isn't silently broken (e.g. off-by-one in
    // the die range) by deriving RTP a second, independent way.
    const dieSums = [1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1]; // counts for sums 2..12, out of 36
    const totalOutcomes = 36 * 36;
    let tieOutcomes = 0;
    dieSums.forEach(count => { tieOutcomes += count * count; });

    const pTie = tieOutcomes / totalOutcomes;
    const pWin = (1 - pTie) / 2;
    const pLose = pWin;

    const expectedRTP = 1 + (pWin * (WIN_PAYOUT_MULTIPLIER - 1) - pLose);
    const actualRTP = theoreticalRTP(WIN_PAYOUT_MULTIPLIER);

    assert.ok(Math.abs(expectedRTP - actualRTP) < 1e-9);
});
