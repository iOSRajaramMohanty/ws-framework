import type { Client } from "../types/client.js";
import type { IClientRegistry } from "../types/contracts.js";

/** Default in-memory implementation of {@link IClientRegistry}. */
export class ClientRegistry implements IClientRegistry {
  private readonly byId = new Map<string, Client>();

  get size(): number {
    return this.byId.size;
  }

  add(client: Client): void {
    this.byId.set(client.id, client);
  }

  remove(clientId: string): boolean {
    return this.byId.delete(clientId);
  }

  get(clientId: string): Client | undefined {
    return this.byId.get(clientId);
  }

  values(): IterableIterator<Client> {
    return this.byId.values();
  }
}
