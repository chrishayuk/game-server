  import { v4 as uuidv4 } from "uuid";
  import { Game, GameResult, GameState } from "./Game";

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
    public onGameResolved?: (outcomes: GameResult<TMove, TOutcome>[]) => void;


    constructor(
      resolveGameStrategy: ResolveGameStrategy<TMove, TOutcome>,
      checkGameInProgressStrategy: CheckGameInProgressStrategy<TMove>
    ) {
      this.resolveGameStrategy = resolveGameStrategy;
      this.checkGameInProgressStrategy = checkGameInProgressStrategy;
    }

    // sets up the game hooks
    private setupGameHooks(game: Game<TMove, TOutcome>): void {
      // on game start
      game.onGameStart = (startedGame) => {
        // game started
        console.debug(`Game ${startedGame.gameId}: Game started.`);
      };

      // on game end
      game.onGameEnd = (endedGame) => {
        // game ended
        console.debug(`Game ${endedGame.gameId}: Game ended.`);
      };

      // player moved
      game.onPlayerMove = (playerId, move) => {
        // player moved
        console.debug(`Game ${game.gameId}: Player ${playerId} made a move: ${move}`);
      };
    }

    // create the game
    public createGame(): string {
      // generate a new id
      const gameId = uuidv4();

      // create the new game
      const newGame = new Game<TMove, TOutcome>(gameId);

      // Setup hooks for the new game
      this.setupGameHooks(newGame);

      // add the game
      this.games.set(gameId, newGame);

      // return the game id
      return gameId;
    }

    // Method to check if a game is ready to start
    public isGameReadyToStart(gameId: string): boolean {
      // get the game
      const game = this.games.get(gameId);

      // no game found
      if (!game) {
        console.error(`Game with ID ${gameId} does not exist.`);
        return false;
      }

      // Example condition: a Rock Paper Scissors game is ready if it has exactly two players and is not in progress
      return game.players.size === 2 && !game.gameInProgress;
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

    // end the game
    public endGame(gameId: string): void {
      // Check if the game still exists before attempting to end it
      if (!this.games.has(gameId)) {
        console.debug(`Game ${gameId}: Attempt to end a game that does not exist or has already been ended.`);
        return;
      }

      const game = this.games.get(gameId);
      if (game) {
        // ending the game
        console.debug(`Game ${gameId}: ending game`);

        // End the game and perform cleanup
        game.end();

        // Remove the game from the list of active games
        this.games.delete(gameId);

        // Remove the players from the game mapping
        game.getPlayers().forEach((playerId) => {
          this.playerGameMapping.delete(playerId);
        });

        console.debug(`Game ${gameId}: game has been ended and cleaned up.`);
      } else {
        console.warn(`Game ${gameId}: game was not found when attempting to end it.`);
      }
    }

    // is the game in progress
    public isGameInProgress(gameId: string): boolean {
      // get the game
      const game = this.games.get(gameId);

      // return if in progress
      return game ? game.gameInProgress : false;
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

      // check we have a game, it's not in progress, and it has not ended
      if (game && !game.gameInProgress && game.state !== GameState.Ended) {
        // add the player to the game
        game.players.add(playerId);

        // add the player to the game mapping
        this.playerGameMapping.set(playerId, gameId);

        // success
        return true;
      }

      // failed to add player to the game because it's either in progress or has ended
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

    // add the player move
    public addPlayerMove(playerId: string, move: TMove): void {
      // Retrieve the gameId from the mapping
      const gameId = this.playerGameMapping.get(playerId);
    
      // Retrieve the actual game object using the gameId
      const game = gameId ? this.games.get(gameId) : undefined;
    
      // Add the move to the game
      if (game) {
        // add the move
        game.addMove(playerId, move);
      }
    }

    // New method to handle game resolution
    public resolveGame(game: Game<TMove, TOutcome>): void {
      // Check that onGameResolved is defined before attempting to call it
      if (this.onGameResolved) {
        // Call the game resolution strategy
        this.resolveGameStrategy(game, this.onGameResolved);
      }
    }
  }
