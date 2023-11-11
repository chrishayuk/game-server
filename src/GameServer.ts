import { v4 as uuidv4 } from "uuid";
import { Game, GameResult } from "./Game";

export type ResolveGameStrategy<TMove, TOutcome> = (
  game: Game<TMove, TOutcome>,
  onGameResolved: (
    playerId: string,
    result: GameResult<TMove, TOutcome>
  ) => void
) => void;

export type CheckGameInProgressStrategy<TMove> = (
  game: Game<TMove, TOutcome>
) => boolean;

export class GameServer<TMove, TOutcome> {
  private games: Map<string, Game<TMove, TOutcome>> = new Map();
  private playerGameMapping: Map<string, string> = new Map();
  private resolveGameStrategy: ResolveGameStrategy<TMove, TOutcome>;
  private checkGameInProgressStrategy: CheckGameInProgressStrategy<TMove>;
  public onGameResolved?: (
    playerId: string,
    result: GameResult<TMove, TOutcome>
  ) => void;

  constructor(
    resolveGameStrategy: ResolveGameStrategy<TMove, TOutcome>,
    checkGameInProgressStrategy: CheckGameInProgressStrategy<TMove>
  ) {
    this.resolveGameStrategy = resolveGameStrategy;
    this.checkGameInProgressStrategy = checkGameInProgressStrategy;
  }

  // create the game
  public createGame(): string {
    // generate a new id
    const gameId = uuidv4();

    // create the new game
    const newGame = new Game<TMove, TOutcome>(gameId);

    // add the game
    this.games.set(gameId, newGame);

    // return the game id
    return gameId;
  }

  // Method to check if a game is ready to start
  public isGameReadyToStart(gameId: string): boolean {
    const game = this.games.get(gameId);
    if (!game) {
      console.error(`Game with ID ${gameId} does not exist.`);
      return false;
    }

    // Example condition: a Rock Paper Scissors game is ready if it has exactly two players and is not in progress
    return game.players.size === 2 && !game.gameInProgress;
  }

  // Get the game ID for a given player ID
  public getPlayerGame(playerId: string): string | undefined {
    return this.playerGameMapping.get(playerId);
  }

  // Method to get the players in a game by gameId
  public getPlayersInGame(gameId: string): Set<string> | undefined {
    const game = this.games.get(gameId);
    return game?.players;
  }

  // Get the game for a given game ID
  public getGame(gameId: string): Game<TMove, TOutcome> | undefined {
    return this.games.get(gameId);
  }

  // Method to get the opponent player ID for a player in a specific game
  public getOpponentPlayerId(playerId: string): string | null {
    // get the game id
    const gameId = this.playerGameMapping.get(playerId);

    // make sure player is in a game
    if (!gameId) {
      return null; // Player is not in a game
    }

    // get the game
    const game = this.games.get(gameId);
    if (!game) {
      return null; // Game does not exist
    }

    // get the opponent player id
    return game.getOpponentPlayerId(playerId);
  }

  // Method to get the number of players in a game
  public getNumberOfPlayersInGame(gameId: string): number {
    // get the game by id
    const game = this.games.get(gameId);

    // check we have a game
    if (!game) {
      // no game, no players
      return 0;
    }

    // return the number of players
    return game.players.size;
  }

  // add the player to the game
  public addPlayerToGame(playerId: string, gameId: string): boolean {
    // get the game by id
    const game = this.games.get(gameId);

    // check we have a game and it's not in progress
    if (game && !game.gameInProgress) {
      // add the player to the game
      game.players.add(playerId);

      // add the player to the game mapping
      this.playerGameMapping.set(playerId, gameId);

      // success
      return true;
    }

    // failed to add player to the game
    return false;
  }

  // remove the player from the game
  public removePlayerFromGame(playerId: string): void {
    // get the game by player id
    const gameId = this.playerGameMapping.get(playerId);

    // ensure we have a game id
    if (gameId) {
      // get the game
      const game = this.games.get(gameId);

      // ensure we have a game
      if (game) {
        // remove the player
        game.players.delete(playerId);

        // if there's no players left
        if (game.players.size === 0) {
          // delete the game
          this.games.delete(gameId);
        }
      }

      // remove the game from the mapping
      this.playerGameMapping.delete(playerId);
    }
  }

  public addPlayerMove(playerId: string, move: TMove): void {
    // Retrieve the gameId from the mapping
    const gameId = this.playerGameMapping.get(playerId);
  
    // Retrieve the actual game object using the gameId
    const game = gameId ? this.games.get(gameId) : undefined;
  
    if (game && game.players.size === 2) {
      // Correctly accessing playersMoves from the game object
      game.playersMoves.set(playerId, move);
  
      // Now you can check if both players have made their moves and resolve the game
      if (game.playersMoves.size === 2 && this.onGameResolved) {
        this.resolveGameStrategy(game, this.onGameResolved);
      }
    }
  }
  

  // start the game
  public startGame(gameId: string): void {
    // get the game
    const game = this.games.get(gameId);

    // ensure we have a game and not in progress
    if (game && !game.gameInProgress) {
      // start the game
      game.start();
    }
  }

  public endGame(gameId: string): void {
    // get the game
    const game = this.games.get(gameId);

    // ensure we have a game
    if (game) {
      // end and delete the game
      game.end();
      this.games.delete(gameId);

      // remove the players from the game
      game.getPlayers().forEach((playerId) => {
        this.playerGameMapping.delete(playerId);
      });
    }
  }

  // is the game in progress
  public isGameInProgress(gameId: string): boolean {
    // get the game
    const game = this.games.get(gameId);

    // return if in progress
    return game ? game.gameInProgress : false;
  }
}
