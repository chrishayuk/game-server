// index.tsx
import { WebSocketConnectionManager } from "./WebSocketConnectionManager";
// import { RockPaperScissorsServer } from "./RockPaperScissorsServer"; // Import the RPS server
import { TimeServer } from "./bots/TimeServer"; // Import the TimeServer

const connectionManager = new WebSocketConnectionManager();
// const rpsGame = new RockPaperScissorsServer(connectionManager); // Initialize the RPS game server
const timeServer = new TimeServer(connectionManager); // Initialize the TimeServer

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
      const playerId = crypto.randomUUID();
      console.debug(`Connection opened: ${playerId}`);

      // For now, we only handle the TimeServer
      // If you later want to use the RPS game server, you can uncomment the next line
      // rpsGame.handleNewPlayer(playerId, ws);

      // Handle a new connection for the TimeServer
      timeServer.handleNewConnection(playerId, ws);
    },
    message(ws, message) {
      const playerId = connectionManager.getPlayerIdByConnection(ws);

      // check we have a player
      if (playerId) {
        // Convert message to string if it's an ArrayBuffer
        const messageString = typeof message === 'string' ? message : new TextDecoder().decode(message);

        // You can add logic here to determine which server should handle the message
        // If it's a game message
        // rpsGame.handlePlayerMessage(playerId, message);

        // Handle TimeServer messages
        timeServer.handleMessage(playerId, messageString);
      } else {
        console.error(`Message from unknown connection: ${message}`);
        ws.send("Unable to identify the connection.");
      }
    },
    close(ws) {
      const playerId = connectionManager.getPlayerIdByConnection(ws);

      if (playerId) {
        // Inform the RPS game server about the disconnection
        // rpsGame.handlePlayerDisconnection(playerId);

        // Inform the TimeServer about the disconnection
        timeServer.handleDisconnection(playerId);
        console.debug(`Connection closed: ${playerId}`);
      } else {
        console.debug("Unknown connection closed");
      }
    },
  },
});

console.log(`Listening on localhost:${server.port}`);