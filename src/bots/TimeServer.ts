// TimeServer.ts
import { ServerWebSocket } from "bun";
import { WebSocketConnectionManager } from "../WebSocketConnectionManager";

export class TimeServer {
  private connectionManager: WebSocketConnectionManager;

  constructor(connectionManager: WebSocketConnectionManager) {
    this.connectionManager = connectionManager;
  }

  // new connection to the time server
  public handleNewConnection(playerId: string, ws: ServerWebSocket<unknown>) {
    // add the connection
    this.connectionManager.addConnection(playerId, ws);
    console.debug(`Player connected: ${playerId}`);

    // welcome message
    const welcomeMessage = "Welcome to the Time Server! Ask 'What's the time?' and I shall answer.";

    // sends the welcome message to the player
    this.connectionManager.sendMessage(playerId, welcomeMessage);
  }

  // handle a message
  public handleMessage(playerId: string, message: string) {
    // checks's for a what's the time message
    if (message.trim().toLowerCase() === "what's the time?") {
        // works out the time
        const currentTime = new Date().toLocaleTimeString();
        
        // sends the time
        this.connectionManager.sendMessage(playerId, `The time is ${currentTime}.`);
    } else {
        // invalid message
        this.connectionManager.sendMessage(playerId, "I can only tell you the time if you ask nicely!");
    }
  }

  // disconnects from time server
  public handleDisconnection(playerId: string) {
    // goodbye message
    const goodbyeMessage =
      "Thank you for using the Time Server. Have a great day!";

    // send the message
    this.connectionManager.sendMessage(playerId, goodbyeMessage);

    // Remove the connection from the manager
    this.connectionManager.removeConnection(playerId);
  }
}
