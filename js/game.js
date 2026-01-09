class Dice {
    constructor() {
        this.value = 1;
    }

    roll() {
        this.value = Math.floor(Math.random() * 6) + 1;
        return this.value;
    }
}

class Game {
    constructor(initialBalance = 1000) {
        this.balance = initialBalance;
        this.playerDice = [new Dice(), new Dice()];
        this.opponentDice = [new Dice(), new Dice()];
        this.isRolling = false;
    }

    // Roll all dice
    rollAll() {
        const pRolls = this.playerDice.map(d => d.roll());
        const oRolls = this.opponentDice.map(d => d.roll());
        return { player: pRolls, opponent: oRolls };
    }

    // Calculate score (Sum of dice)
    getScore(rolls) {
        return rolls.reduce((a, b) => a + b, 0);
    }

    // Determine winner
    // Returns: 'player', 'opponent', or 'tie'
    determineWinner(playerScore, opponentScore) {
        if (playerScore > opponentScore) return 'player';
        if (opponentScore > playerScore) return 'opponent';
        return 'tie';
    }

    placeBet(amount) {
        if (amount <= 0) throw new Error("Bet must be positive!");
        if (amount > this.balance) throw new Error("Not enough doubloons!");

        // Deduct bet immediately? 
        // Or wait until result? Standard casino logic often deducts on bet.
        this.balance -= amount;
        return true;
    }

    resolveRound(betAmount, winner) {
        let winnings = 0;
        if (winner === 'player') {
            winnings = betAmount * 2;
            this.balance += winnings;
        } else if (winner === 'tie') {
            // Push - return original bet
            winnings = betAmount;
            this.balance += winnings;
        }
        // If opponent wins, money is already lost (deducted in placeBet)

        return winnings;
    }
}
