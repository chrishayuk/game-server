// index.tsx
import { WebSocketConnectionManager } from "./WebSocketConnectionManager";
import { RockPaperScissorsServer } from "./RockPaperScissorsServer";

const connectionManager = new WebSocketConnectionManager();
const game = new RockPaperScissorsServer(connectionManager); // Pass the connection manager to the game

const server = Bun.serve({
  port: 3000,
  fetch(req, server) {
    if (server.upgrade(req)) {
      return; // WebSocket upgrade request
    }
    return new Response("Not found", { status: 404, statusText: "Not Found" });
  },
  websocket: {
    open(ws) {
      // Create the player ID
      const playerId = crypto.randomUUID();
      //console.debug(`Player connected: ${playerId}`);
    
      // Handle a new player joining the game
      game.handleNewPlayer(playerId, ws);
    },
    message(ws, message) {
      // get the player id from the connection
      const playerId = connectionManager.getPlayerIdByConnection(ws);

      // ensure we have a player id
      if (playerId) {
        // received a message from a player
        //console.debug(`Message from player ${playerId}: ${message}`);

        // call the game's handle player message
        game.handlePlayerMessage(playerId, message);
      } else {
        // message from an unknown connection
        console.error(`Message from unknown connection: ${message}`);
        ws.send("Unable to identify the player.");
      }
    },
    close(ws) {
      // get the player id
      const playerId = connectionManager.getPlayerIdByConnection(ws);

      // ensure we have a player id
      if (playerId) {
        // disconnect the player from the game
        //console.debug(`Player disconnected: ${playerId}`);

        // disconnect the player from the game
        game.handlePlayerDisconnection(playerId);
      } else {
        // unknown connection
        console.debug("Unknown connection closed");
      }
    },
  },
});

console.log(`Listening on localhost:${server.port}`);
