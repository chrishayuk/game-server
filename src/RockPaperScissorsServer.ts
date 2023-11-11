import { ServerWebSocket } from "bun";
import { GameServer, ResolveGameStrategy, CheckGameInProgressStrategy } from "./GameServer";
import { Game, GameResult } from "./Game";
import { WebSocketConnectionManager } from "./WebSocketConnectionManager";

export type PlayerMove = "rock" | "paper" | "scissors";
export type GameOutcome = "win" | "lose" | "draw";

export class RockPaperScissorsServer {
  private gameServer: GameServer<PlayerMove, GameOutcome>;
  private connectionManager: WebSocketConnectionManager;
  private waitingGames: string[] = [];

  constructor(connectionManager: WebSocketConnectionManager) {
    this.connectionManager = connectionManager;
    this.gameServer = new GameServer<PlayerMove, GameOutcome>(
      this.resolveGameStrategy,
      this.checkGameInProgressStrategy
    );

    // game resolved
    this.gameServer.onGameResolved = (outcomes) => {
      outcomes.forEach(result => {
        const ws = this.connectionManager.getConnection(result.playerId);
        if (ws) {
          ws.send(`Game ${result.gameId}: Game over. You ${result.outcome}. Opponent chose ${result.opponentMove}.`);
          // Handle starting a new game outside of this loop to avoid duplicating the logic
        } else {
          console.error(`Connection not found for player ID: ${result.playerId}`);
        }
      });
    
      // Start a new game with a delay after resolving the last game
      setTimeout(() => {
        this.startNewGameWithPlayers(outcomes[0].gameId); // Assuming the game ID is the same for both outcomes
      }, 1000);
    };
  }

  // start new game with players
  private startNewGameWithPlayers(oldGameId: string): void {
    // Get the players from the old game before it's ended
    const players = new Set(this.gameServer.getPlayersInGame(oldGameId));

    // End the old game
    this.gameServer.endGame(oldGameId);

    // If we have the correct number of players, start a new game
    if (players.size === 2) {
      // Create a new game
      const newGameId = this.gameServer.createGame();

      // Add the players to the new game
      for (const playerId of players) {
        this.gameServer.addPlayerToGame(playerId, newGameId);
        this.connectionManager.sendMessage(
          playerId,
          `Game ${newGameId}: A new game has started. Please play 'rock', 'paper', or 'scissors'.`
        );
      }

      // Attempt to start the new game
      this.tryStartGame(newGameId);
    } else {
      console.error(
        `Game ${oldGameId} could not start a new game with the players because of a mismatched player count.`
      );
    }
  }

  // handle new player
  public handleNewPlayer(playerId: string, ws: ServerWebSocket<unknown>) {
    // add the connection
    this.connectionManager.addConnection(playerId, ws);
    console.debug(`Player connected: ${playerId}`);

    // place the player in the game
    const gameId = this.placePlayerInGame(playerId);

    // start the game
    this.tryStartGame(gameId);
  }

  private placePlayerInGame(playerId: string): string {
    let gameId: string;

    // Check if there's a waiting game
    if (this.waitingGames.length > 0) {
      // Join the first waiting game
      gameId = this.waitingGames.shift()!;

      // add the player to the game
      this.gameServer.addPlayerToGame(playerId, gameId);
      console.log(`Game ${gameId}: Player ${playerId} added to existing game.`);
    } else {
      // Create a new game if there isn't one waiting
      gameId = this.gameServer.createGame();

      // add the player to the game
      this.gameServer.addPlayerToGame(playerId, gameId);
      console.log(
        `Game ${gameId}: Player ${playerId} created and added to new game.`
      );
      this.waitingGames.push(gameId);
    }

    // Send a single welcome message here
    this.connectionManager.sendMessage(
      playerId,
      `Game ${gameId}: Welcome! You are Player ${playerId}.`
    );

    // If the game does not have enough players yet, send a waiting message
    if (this.gameServer.getPlayersInGame(gameId)?.size === 1) {
      // waiting for an opponent
      this.connectionManager.sendMessage(
        playerId,
        `Game ${gameId}: Waiting for an opponent...`
      );
    } else if (this.gameServer.getPlayersInGame(gameId)?.size === 2) {
      // If two players are now in the game, notify them of their opponent
      this.notifyPlayersOfOpponents(gameId);
    }

    // return the game
    return gameId;
  }

  private isGameReadyToStart(gameId: string): boolean {
    // get the game
    const game = this.gameServer.getGame(gameId);

    // no game
    if (!game) return false;

    // The game is ready to start if there are enough players, e.g., 2 for RPS
    return game.players.size === 2;
  }

  private notifyPlayersOfOpponents(gameId: string): void {
    // get the the players in the game
    const playersInGame = this.gameServer.getPlayersInGame(gameId);

    // ensure it's a 2 player game
    if (playersInGame && playersInGame.size === 2) {
      // loop through the players
      playersInGame.forEach((pid) => {
        // get the opponent id
        const opponentId = this.getOpponentId(gameId, pid);

        // if it's an opponent
        if (opponentId) {
          // send the message
          this.connectionManager.sendMessage(
            pid,
            `Game ${gameId}: Your opponent is player ${opponentId}.`
          );
        } else {
          // couldn't find
          console.error(
            `Game ${gameId}: Could not find an opponent for player ${pid}.`
          );
        }
      });
    }
  }

  // get the opponent
  private getOpponentId(gameId: string, playerId: string): string | null {
    // get the players in the game
    const playersInGame = this.gameServer.getPlayersInGame(gameId);

    // no players
    if (!playersInGame) {
      console.error(`Game ${gameId}: Game does not exist or has no players.`);
      return null;
    }

    // loop through the players
    for (const pid of playersInGame) {
      // check if they're not equal
      if (pid !== playerId) {
        // Found the opponent
        return pid;
      }
    }

    // No opponent found (shouldn't happen in a two-player game)
    return null;
  }

  // Call this method when you need to check if the game can start and notify players accordingly
  public tryStartGame(gameId: string): void {
    // Check if the game is ready to start
    const game = this.gameServer.getGame(gameId);

    // ensure we are ready to start the game
    if (game && this.gameServer.isGameReadyToStart(gameId)) {
      // Start the game and notify players
      this.gameServer.startGame(gameId);

      // send message to players in the game
      this.sendMessageToPlayersInGame(
        gameId,
        `Game ${gameId}: The game is starting. Please play 'rock', 'paper', or 'scissors'`
      );
    }
  }

  // Function to send a message to all players in a specific game
  private sendMessageToPlayersInGame(gameId: string, message: string): void {
    // get the players in a game
    const playersInGame = this.gameServer.getPlayersInGame(gameId);

    // ensure we have players
    if (playersInGame) {
      // loop through the players
      playersInGame.forEach((playerId) => {
        // send the message
        this.connectionManager.sendMessage(playerId, message);
      });
    } else {
      // no game or players
      console.error(`Game ${gameId}: Game does not exist or has no players.`);
    }
  }

  // handle the player disconnection
  public handlePlayerDisconnection(playerId: string) {
    // get the game id for the player
    const gameId = this.gameServer.getPlayerGame(playerId);

    // check we have a game
    if (gameId) {
      // get the opponent
      const otherPlayerId = this.gameServer.getOpponentPlayerId(playerId);

      // get the other player
      if (otherPlayerId) {
        // opponent disconnected
        this.connectionManager.sendMessage(
          otherPlayerId,
          `Game ${gameId}: Your opponent has disconnected. The game has been ended.`
        );
        this.placePlayerInGame(otherPlayerId); // Reuse the new function
      }

      // end the game
      this.gameServer.endGame(gameId);

      // remove the player
      this.connectionManager.removeConnection(playerId);
    } else {
      // disconnected
      console.debug(`Player ${playerId} disconnected without being in a game.`);
    }

    // remove the player from the game
    this.gameServer.removePlayerFromGame(playerId);
  }

  public handlePlayerMessage(playerId: string, message: unknown) {
    // Attempt to parse the message as a move
    const move = this.parseMessage(message);

    // Get the game id for the player
    const gameId = this.gameServer.getPlayerGame(playerId);

    // TODO: in the future may add the ability to ask non game questions

    // no game found
    if (!gameId) {
      // player is not in a game
      console.error(`Player ${playerId} is not associated with any game.`);

      // send a message to say you're not in a game
      this.connectionManager.sendMessage(
        playerId,
        "You are not currently in a game."
      );
      return;
    }

    // Check if we have a valid move and a valid game
    if (move && gameId) {
      // Add the player's move to the game
      this.gameServer.addPlayerMove(playerId, move);

      // Log the move
      console.log(`Game ${gameId}: Player ${playerId} played ${move}`);

      // Retrieve the game object for the player
      const game = this.gameServer.getGame(gameId);

      // Ensure the game exists and check if the game is resolvable
      if (game && this.shouldResolveGame(game)) {
        // If the game is ready to be resolved according to RPS logic, resolve the game
        this.gameServer.resolveGame(game);
      } else {
        // If the game is not yet resolvable, notify the player to wait
        this.connectionManager.sendMessage(
          playerId,
          `Game ${gameId}: Waiting for the opponent's move.`
        );
      }
    } else {
      // If the move is not valid, notify the player with the specific game ID
      this.connectionManager.sendMessage(
        playerId,
        `Game ${gameId}: Invalid choice. Please play 'rock', 'paper', or 'scissors'.`
      );

      // Log the invalid move attempt
      console.warn(
        `Game ${gameId}: Player ${playerId} made an invalid move: ${message}`
      );
    }
  }

  // Specific RPS logic to determine if the game should be resolved
  private shouldResolveGame(game: Game<PlayerMove, GameOutcome>): boolean {
    // RPS game resolves when we have 2 moves
    return game.playersMoves.size === 2;
  }

  // parse the message
  private parseMessage(message: unknown): PlayerMove | null {
    // parse the move
    const move =
      typeof message === "string" ? message.trim().toLowerCase() : null;

    // check it's valid
    return this.isValidChoice(move) ? move : null;
  }

  // check the move is valid
  private isValidChoice(move: string | null): move is PlayerMove {
    // it's gotta be rock, paper or scissors
    return ["rock", "paper", "scissors"].includes(move || "");
  }

  private resolveGameStrategy: ResolveGameStrategy<PlayerMove, GameOutcome> = (
    game: Game<PlayerMove, GameOutcome>,
    onGameResolved: (outcomes: GameResult<PlayerMove, GameOutcome>[]) => void
  ) => {
    // Ensure we have two moves before resolving
    if (game.playersMoves.size === 2) {
      // Extract the player IDs and moves from the game state
      const [player1Id, player2Id] = Array.from(game.players);
      const player1Move = game.playersMoves.get(player1Id) as PlayerMove;
      const player2Move = game.playersMoves.get(player2Id) as PlayerMove;
  
      // Define the outcomes matrix
      const outcomes = {
        rock: { rock: "draw", paper: "lose", scissors: "win" },
        paper: { rock: "win", paper: "draw", scissors: "lose" },
        scissors: { rock: "lose", paper: "win", scissors: "draw" },
      };
  
      // Create the game results for both players
      const playerOutcomes = [
        {
          playerId: player1Id,
          outcome: outcomes[player1Move][player2Move] as GameOutcome,
          opponentMove: player2Move,
          gameId: game.gameId,
        },
        {
          playerId: player2Id,
          outcome: outcomes[player2Move][player1Move] as GameOutcome,
          opponentMove: player1Move,
          gameId: game.gameId,
        },
      ];
  
      // Call the game resolution once with all outcomes
      onGameResolved(playerOutcomes);
    }
  };

  private checkGameInProgressStrategy: CheckGameInProgressStrategy<PlayerMove> =
    (playersMoves: any) => {
      // Implement the logic to check if the game is in progress
      return playersMoves.size === 2;
    };
}
