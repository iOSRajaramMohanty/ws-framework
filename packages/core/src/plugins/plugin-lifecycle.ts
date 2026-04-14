import type { Client } from "../types/client.js";
import type {
  IPluginLifecycleCoordinator,
  PluginPreConnectionHook,
  PluginConnectionHook,
  PluginDisconnectHook,
  PluginMessageHook,
} from "../types/plugin/lifecycle.js";
import type { WsLogger } from "../types/logger.js";

type ResolvedLogger = Required<WsLogger>;

/**
 * Ordered hook lists for plugins. Core never mutates these except through
 * {@link PluginHookRegistry} registrations from {@link WsServer.use}.
 */
export class PluginLifecycleCoordinator implements IPluginLifecycleCoordinator {
  private readonly preConnectionHooks: PluginPreConnectionHook[] = [];
  private readonly connectionHooks: PluginConnectionHook[] = [];
  private readonly disconnectHooks: PluginDisconnectHook[] = [];
  private readonly messageHooks: PluginMessageHook[] = [];

  constructor(private readonly log: ResolvedLogger) {}

  preConnection(handler: PluginPreConnectionHook): void {
    this.preConnectionHooks.push(handler);
  }

  connection(handler: PluginConnectionHook): void {
    this.connectionHooks.push(handler);
  }

  disconnect(handler: PluginDisconnectHook): void {
    this.disconnectHooks.push(handler);
  }

  message(handler: PluginMessageHook): void {
    this.messageHooks.push(handler);
  }

  async runPreConnection(client: Client): Promise<void> {
    for (const fn of this.preConnectionHooks) {
      try {
        await fn(client);
      } catch (err) {
        this.log.error("Plugin pre-connection hook error", { clientId: client.id, err });
      }
    }
  }

  async runConnection(client: Client): Promise<void> {
    for (const fn of this.connectionHooks) {
      try {
        await fn(client);
      } catch (err) {
        this.log.error("Plugin connection hook error", { clientId: client.id, err });
      }
    }
  }

  async runDisconnect(client: Client): Promise<void> {
    for (const fn of this.disconnectHooks) {
      try {
        await fn(client);
      } catch (err) {
        this.log.error("Plugin disconnect hook error", { clientId: client.id, err });
      }
    }
  }

  async runMessage(client: Client, event: string, data: unknown): Promise<boolean> {
    for (const fn of this.messageHooks) {
      try {
        const res = await fn(client, event, data);
        if (res === false) {
          return false;
        }
      } catch (err) {
        this.log.error("Plugin message hook error", { clientId: client.id, event, err });
      }
    }
    return true;
  }
}
