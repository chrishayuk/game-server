import { WebSocketConnectionManager } from "./WebSocketConnectionManager.ts";

export class BotManager {
    // Map of bot IDs to their names or types
    private botRegistry = new Map<string, string>(); 
    private recentBots = new Array<string>();

    // constructor
    constructor(private connectionManager: WebSocketConnectionManager) {}
  
    // Method for bots to register themselves
    registerBot(clientId: string, botName: string) {
        // add the bot to the registry
        this.botRegistry.set(clientId, botName);

        // add to the recent bot list
        this.recentBots.push(clientId); // Add to the end of the list
        if (this.recentBots.length > 10) {
            // Remove the first item if the list exceeds 10
            const removedBotId = this.recentBots.shift(); 
        }

        // bot registered
        console.log(`Bot registered: ${botName} (${clientId})`);
    }
  
    // Method for bots to unregister themselves
    unregisterBot(clientId: string) {
        // get the bot
        const botName = this.botRegistry.get(clientId);

        // is there a bot
        if (botName){
            // delete the bot from the registry
            this.botRegistry.delete(clientId);

            // remove from the recent list
            this.recentBots = this.recentBots.filter(id => id !== clientId);

            // unregistered
            console.log(`Bot unregistered: ${botName} (${clientId})`);
        }
    }
  
    // Method to list all connected bots
    listConnectedBots(): string[] {
        // Map the last 10 (or fewer) bot IDs to their names
        return this.recentBots
            .slice(-10) // Get the last 10 entries
            .map(id => `${this.botRegistry.get(id)} (${id})`);
    }
  }
  