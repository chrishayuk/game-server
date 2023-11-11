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

    // Set the callback for when a game is resolved
    this.gameServer.onGameResolved = (playerId, result) => {
      const ws = this.connectionManager.getConnection(playerId);
      if (ws) {
        ws.send(`Game over. You ${result.outcome}. Opponent chose ${result.opponentMove}.`);
      } else {
        console.error(`Connection not found for player ID: ${playerId}`);
      }
    };
  }

  // handle new player
  public handleNewPlayer(playerId: string, ws: ServerWebSocket<unknown>) {
    // add the connection
    this.connectionManager.addConnection(playerId, ws);
    //console.debug(`Player connected: ${playerId}`);
  
    let gameId: string;
  
    // Check if there is a game waiting for a second player
    if (this.waitingGames.length > 0) {
      // Join the first waiting game
      gameId = this.waitingGames.shift()!;
      this.gameServer.addPlayerToGame(playerId, gameId);
      //console.debug(`Player ${playerId} added to existing game ${gameId}`); // Debug log for joining existing game
    } else {
      // No games are waiting, so create a new one
      gameId = this.gameServer.createGame();
      this.gameServer.addPlayerToGame(playerId, gameId);
      
      // Since this is a new game with only one player, add it to the waiting list
      this.waitingGames.push(gameId);
      //console.debug(`Player ${playerId} added to new game ${gameId}`); // Debug log for creating a new game
    }
  
    // Welcome message and check if the game can start now
    this.connectionManager.sendMessage(playerId, `Game ${gameId}: Welcome! You are Player ${playerId}.`);
    //console.debug(`Welcome message sent to Player ${playerId} for Game ${gameId}`); // Debug log for welcome message
    this.tryStartGame(gameId);
  }
  

  // try start the game
  private tryStartGame(gameId: string) {
    // are we ready to start
    if (this.gameServer.isGameReadyToStart(gameId)) {
      // start the game
      this.notifyPlayersAndStartGame(gameId);
    } else {
      // Use the new function to send a message to all players in the game
      this.sendMessageToPlayersInGame(
        gameId,
        `Game ${gameId}: Waiting for more players to start the game...`
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
      console.error(`Game with ID ${gameId} does not exist or has no players.`);
    }
  }

  // start the game
  private notifyPlayersAndStartGame(gameId: string) {
    // get players in the game
    const playersInGame = this.gameServer.getPlayersInGame(gameId);

    // debug
    //console.debug(`Attempting to start game with ID: ${gameId}`); // Debugging log

    // do we have players
    if (playersInGame && playersInGame.size === 2) {
      // Use the new function to notify players that the game is starting
      this.sendMessageToPlayersInGame(
        gameId,
        `Game ${gameId}: Game is starting. Please play 'rock', 'paper', or 'scissors'.`
      );

      // Start the game
      this.gameServer.startGame(gameId);
    } else {
      // not ready to start
      console.error(`Game with ID ${gameId} is not ready to start.`);
    }
  }

  public handlePlayerDisconnection(playerId: string) {
    // get the game
    const gameId = this.gameServer.getPlayerGame(playerId);

    // we have a game
    if (gameId) {
      // remove the player
      this.gameServer.removePlayerFromGame(playerId);
      this.connectionManager.removeConnection(playerId);

      // ensure we don't have a game in progress
      if (!this.gameServer.isGameInProgress(gameId)) {
        // end the game
        this.gameServer.endGame(gameId);

        // Use the new function to broadcast the disconnection message to the game
        this.sendMessageToPlayersInGame(
          gameId,
          `Game ${gameId}: Player ${playerId} has left the game. Waiting for a new opponent...`
        );
      }
    } else {
      // Handle the case where there is no game associated with the player
    }
  }

  public handlePlayerMessage(playerId: string, message: unknown) {
    const move = this.parseMessage(message);
    if (move) {
      this.gameServer.addPlayerMove(playerId, move);
    } else {
      this.connectionManager.sendMessage(
        playerId,
        "Invalid choice. Please play 'rock', 'paper', or 'scissors'."
      );
    }
  }

  private parseMessage(message: unknown): PlayerMove | null {
    const move =
      typeof message === "string" ? message.trim().toLowerCase() : null;
    return this.isValidChoice(move) ? move : null;
  }

  private isValidChoice(move: string | null): move is PlayerMove {
    return ["rock", "paper", "scissors"].includes(move || "");
  }

  private resolveGameStrategy: ResolveGameStrategy<PlayerMove, GameOutcome> = (
    game: Game<PlayerMove, GameOutcome>,
    onGameResolved: (playerId: string, result: GameResult<PlayerMove, GameOutcome>) => void
  ) => {
    // Ensure we have two moves before resolving
    if (game.playersMoves.size < 2) {
      return; // Not enough players have made their moves to resolve the game
    }
  
    // Extract the player IDs and moves from the game state
    const [player1Id, player2Id] = Array.from(game.players);
    const player1Move = game.playersMoves.get(player1Id);
    const player2Move = game.playersMoves.get(player2Id);

    // Define the outcomes matrix
    const outcomes = {
      rock: { rock: "draw", paper: "lose", scissors: "win" },
      paper: { rock: "win", paper: "draw", scissors: "lose" },
      scissors: { rock: "lose", paper: "win", scissors: "draw" },
    };

    // Use the game ID from the gameServer context
    const gameId = this.gameServer.gameId;

    const gameResult: Record<string, GameResult<PlayerMove, GameOutcome>> = {
      [player1Id]: {
        outcome: outcomes[player1Move][player2Move] as GameOutcome,
        opponentMove: player2Move,
        gameId: gameId!, // Asserting gameId is not null
      },
      [player2Id]: {
        outcome: outcomes[player2Move][player1Move] as GameOutcome,
        opponentMove: player1Move,
        gameId: gameId!, // Asserting gameId is not null
      },
    };

    // Resolve the game for both players
    onGameResolved(player1Id, gameResult[player1Id]);
    onGameResolved(player2Id, gameResult[player2Id]);
  };

  private checkGameInProgressStrategy: CheckGameInProgressStrategy<PlayerMove> =
    (playersMoves: any) => {
      // Implement the logic to check if the game is in progress
      return playersMoves.size === 2;
    };
}
