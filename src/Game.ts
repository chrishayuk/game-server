export type GameResult<TMove, TOutcome> = {
  outcome: TOutcome;
  opponentMove: TMove;
  gameId: string;
};

// the game state
export enum GameState {
  WaitingForPlayers,
  ReadyToStart,
  InProgress,
  Ended,
}

export class Game<TMove, TOutcome> {
  // resolved
  private resolved: boolean = false;
  
  // properties
  public gameId: string;
  public players: Set<string> = new Set();
  public playersMoves: Map<string, TMove> = new Map();
  public gameInProgress: boolean = false;
  public state: GameState = GameState.WaitingForPlayers;

  // Hooks
  public onGameStart?: (game: Game<TMove, TOutcome>) => void;
  public onGameEnd?: (game: Game<TMove, TOutcome>) => void;
  public onPlayerMove?: (playerId: string, move: TMove) => void;

  // set the game id
  constructor(gameId: string) {
    this.gameId = gameId;
  }

  // start the game
  start(): void {
    // game in progress
    this.gameInProgress = true;
    this.state = GameState.InProgress;

    // call the hook
    this.onGameStart?.(this);
  }

  // end the game
  public end(): void {
    // game no longer progress
    this.gameInProgress = false;

    // clear the players and moves
    this.players.clear();
    this.playersMoves.clear();

    // end the game
    this.state = GameState.Ended;
    this.onGameEnd?.(this);
  }

  public isReadyToStart(): boolean {
    // Let's say a game is ready to start if we have exactly two players
    return this.state === GameState.ReadyToStart;
  }

  // Returns a set of player IDs in this game
  public getPlayers(): Set<string> {
    // return the player list
    return this.players;
  }

  // check if we have anyone in the game
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

  // add the player to the game
  addPlayer(playerId: string): void {
    // add the player to the game
    this.players.add(playerId);
  }

  // remove the player from the game
  removePlayer(playerId: string): void {
    // remove the player from the game
    this.players.delete(playerId);

    // remove the players moves from the game
    this.playersMoves.delete(playerId);
  }

  // add the players move to the game
  addMove(playerId: string, move: TMove): void {
    // add the players move to the game
    this.playersMoves.set(playerId, move);

    // call the on player move hook
    this.onPlayerMove?.(playerId, move);
  }

  public hasEnded(): boolean {
    return this.state === GameState.Ended;
  }

  // Method to mark the game as resolved
  public markResolved(): void {
    this.resolved = true;
  }

  // Method to check if the game is already resolved
  public isResolved(): boolean {
    return this.resolved;
  }
  
}
