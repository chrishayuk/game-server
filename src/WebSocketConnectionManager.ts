import { ServerWebSocket } from "bun";

export class WebSocketConnectionManager {
  // connections
  private connections = new Map<string, ServerWebSocket<unknown>>();

  // Utility function to get current player's connection based on WebSocket
  public getCurrentConnection(ws: ServerWebSocket<unknown>): [string | null, ServerWebSocket<unknown> | undefined] {
    // loop through connections
    for (const [playerId, connection] of this.connections) {
      // found the connection
      if (connection === ws) {
        return [playerId, connection];
      }
    }

    // no connection
    return [null, undefined];
  }

  // Get a connection by player ID
  public getConnection(playerId: string): ServerWebSocket<unknown> | undefined {
    // get the connection of the player id
    return this.connections.get(playerId);
  }

  // adds a connection
  public addConnection(playerId: string, ws: ServerWebSocket<unknown>) {
    console.debug(`Adding connection for player: ${playerId}`);
    this.connections.set(playerId, ws);
    console.debug(`Current connections: ${Array.from(this.connections.keys()).join(', ')}`);
  }

  // removes the connection
  public removeConnection(playerId: string) {
    // Attempt to get the connection
    const ws = this.connections.get(playerId);

    if (ws) {
      try {
        // Attempt to close the connection
        ws.close(1000, "Connection closed.");
      } catch (error) {
        // log the error
        console.error(`Error closing connection for player ${playerId}:`, error);
      } finally {
        // Always remove the connection from the map, regardless of whether
        // an error occurred during the close operation
        this.connections.delete(playerId);
      }
    }
  }

  // sends a message to a specific player
  public sendMessage(playerId: string, message: string) {
    // get the connection of the player
    const ws = this.connections.get(playerId);

    // check we have the connection
    if (ws) {
      try {
        // Attempt to send the message
        ws.send(message);
        console.debug(`Message sent to player ${playerId}: ${message}`);
      } catch (error) {
        // error sending message to the player
        console.error(`Error sending message to player ${playerId}:`, error);
      }
    } else {
      // no connection for the player found
      console.warn(`No connection found for player ${playerId}. Unable to send message.`);
      console.debug(`Current connections: ${Array.from(this.connections.keys()).join(', ')}`);
    }
  }

  // sends a direct message
  public sendDirectMessage(senderId: string, receiverId: string, message: string) {
    // get the receiver socket
    const receiverWs = this.connections.get(receiverId);

    // if we have a receiver
    if (receiverWs) {
      try {
        // send the message
        const messageWithSender = `from: ${senderId}, message: ${message}`;
        receiverWs.send(messageWithSender);
        console.debug(`Message from ${senderId} to ${receiverId}: ${message}`);
      } catch (error) {
        // error
        console.error(`Error sending message from ${senderId} to ${receiverId}:`, error);
      }
    } else {
      // no receiver
      console.warn(`No connection found for receiver ${receiverId}.`);
    }
  }
  

  // broadcast a message
  public broadcastMessage(message: string) {
    // loop through the connections
    for (const [playerId, ws] of this.connections) {
      try {
        // Attempt to send a message to the connection
        ws.send(message);
      } catch (error) {
        // error sending message to player
        console.error(`Error sending message to player ${playerId}:`, error);
      }
    }
  }

  // returns the number of connecitons
  public getConnectionCount(): number {
    // returns the number of connections
    return this.connections.size;
  }

  // find the player ID by their WebSocket connection
  public getPlayerIdByConnection(ws: ServerWebSocket<unknown>): string | undefined {
    // loop through the connections
    for (const [id, conn] of this.connections) {
      // match
      if (conn === ws) {
        // return the id
        return id;
      }
    }

    // Return undefined if the connection is not found
    return undefined;
  }
}
