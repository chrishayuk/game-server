// index.tsx
import { WebSocketConnectionManager } from "./WebSocketConnectionManager";
import { BotManager } from "./BotManager"; // Assuming you have a BotDirectory to manage bots

const connectionManager = new WebSocketConnectionManager();
const botManager = new BotManager(connectionManager); // Initialize the bot directory

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
        // generate the client id
        const clientId = crypto.randomUUID();
        console.debug(`Connection opened: ${clientId}`);

        // Register the connection in the connection manager
        connectionManager.addConnection(clientId, ws);
    },
    message(ws, message) {
        // get the client id
        const clientId = connectionManager.getPlayerIdByConnection(ws);

        // found the client
        if (clientId) {
            // parse the message
            const messageString = typeof message === "string" ? message : new TextDecoder().decode(message);

            // Check for direct message command
            const directMessageRegex = /@([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\s+(.+)/;
            const match = messageString.match(directMessageRegex);

            if (match) {
              console.log("direct message");
              const [, targetClientId, directMessage] = match;
              connectionManager.sendDirectMessage(clientId, targetClientId, directMessage);
            } else if (messageString.toLowerCase() === "who's connected?") {
                // If the message is "who is connected", respond with the list of connected bots
                console.log("who's connected");
                const recentConnectedBots = botManager.listConnectedBots();

                // return the list
                connectionManager.sendMessage(clientId, `Recent Connected bots: ${recentConnectedBots.join(', ')}`);
            } else if (messageString.toLowerCase().startsWith("register as ")) {
                // get the command
                const botName = messageString.substring("register as ".length).trim();

                // Register the bot when it connects
                botManager.registerBot(clientId, botName);
            } else {
                // we'll just echo for now
                console.log("echo message");
                ws.send(message);
            }

            // Route the message to the appropriate handler (bot or user)
            //botDirectory.routeMessage(clientId, messageString);
        } else {
            console.error(`Message from unknown connection: ${message}`);
            ws.send("Unable to identify the connection.");
        }
    },
    close(ws) {
        // get the client id
        const clientId = connectionManager.getPlayerIdByConnection(ws);

        // we've got a client
        if (clientId) {
            // unregister the bot
            botManager.unregisterBot(clientId);

            // remove the connection
            connectionManager.removeConnection(clientId);
            console.debug(`Connection closed: ${clientId}`);
        } else {
            console.debug("Unknown connection closed");
        }
    },
  },
});

console.log(`Listening on localhost:${server.port}`);
