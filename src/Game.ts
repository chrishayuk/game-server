export type GameResult<TMove, TOutcome> = {
  outcome: TOutcome;
  opponentMove: TMove;
  gameId: string;
};

export class Game<TMove, TOutcome> {
  public gameId: string;
  public players: Set<string> = new Set();
  public playersMoves: Map<string, TMove> = new Map();
  public gameInProgress: boolean = false;

  constructor(gameId: string) {
    this.gameId = gameId;
  }

  addPlayer(playerId: string): void {
    this.players.add(playerId);
  }

  removePlayer(playerId: string): void {
    this.players.delete(playerId);
    this.playersMoves.delete(playerId); // Also remove the player's move if it was set
  }

  addMove(playerId: string, move: TMove): void {
    this.playersMoves.set(playerId, move);
  }

  start(): void {
    // game in progress
    this.gameInProgress = true;
  }

  public end(): void {
    // game no longer progress
    this.gameInProgress = false;
    this.players.clear(); // Clear the players
    this.playersMoves.clear(); // Clear the moves

    // Perform any other necessary cleanup
    console.debug(`Game with ID ${this.gameId} has ended.`);
  }

  // Returns a set of player IDs in this game
  public getPlayers(): Set<string> {
    return this.players;
  }

  isGameEmpty(): boolean {
    // nobody playing
    return this.players.size === 0;
  }

  // Method to get a player's opponent ID
  public getOpponentPlayerId(playerId: string): string | null {
    // loop through the players
    for (const id of this.players) {
      // if id isn't the player
      if (id !== playerId) {
        // return the opponent
        return id;
      }
    }

    // No opponent found, which could mean only one player is in the game
    return null;
  }
}
