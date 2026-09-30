const mockClients: mockClient[] = [];
let mockInitializeError: Error | null = null;

type EventHandler = (...args: any[]) => Promise<void> | void;

class mockClient {
  public id?: number;

  public handlers: Record<string, EventHandler> = {};

  public info = {
    wid: {
      user: "5511999999999"
    }
  };

  public pupBrowser = {
    version: jest.fn().mockResolvedValue("Chrome/123")
  };

  public initialize = jest.fn(() => {
    if (mockInitializeError) {
      return Promise.reject(mockInitializeError);
    }

    return Promise.resolve();
  });

  public destroy = jest.fn().mockResolvedValue(undefined);

  public getWWebVersion = jest.fn().mockResolvedValue("2.2409.2");

  public sendPresenceAvailable = jest.fn();

  constructor() {
    mockClients.push(this);
  }

  public on(event: string, handler: EventHandler): this {
    this.handlers[event] = handler;
    return this;
  }
}

jest.mock("whatsapp-web.js", () => ({
  Client: mockClient,
  LocalAuth: jest.fn(),
  DefaultOptions: {
    userAgent: "mock-user-agent"
  }
}));

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn(() => ({
    emit: jest.fn()
  }))
}));

jest.mock("../../../services/WbotServices/SyncUnreadMessagesWbot", () =>
  jest.fn()
);

import { getWbot, initWbot, removeWbot } from "../../../libs/wbot";

describe("wbot session cache", () => {
  beforeEach(() => {
    mockClients.length = 0;
    mockInitializeError = null;
  });

  afterEach(async () => {
    for (const client of mockClients) {
      if (client.id) {
        await removeWbot(client.id);
      }
    }
  });

  it("removes a session from the cache before awaiting destroy", async () => {
    const whatsapp = {
      id: 42,
      name: "Main",
      tenantId: 7,
      update: jest.fn().mockResolvedValue(undefined)
    };

    const initPromise = initWbot(whatsapp as any);
    const client = mockClients[0];

    await client.handlers.ready();
    const session = await initPromise;

    expect(getWbot(whatsapp.id)).toBe(session);

    client.destroy.mockImplementation(async () => {
      expect(() => getWbot(whatsapp.id)).toThrow("ERR_WAPP_NOT_INITIALIZED");
    });

    await removeWbot(whatsapp.id);

    expect(client.destroy).toHaveBeenCalledTimes(1);
    expect(() => getWbot(whatsapp.id)).toThrow("ERR_WAPP_NOT_INITIALIZED");
  });

  it("rejects initialization when the underlying client fails to initialize", async () => {
    const whatsapp = {
      id: 43,
      name: "Broken",
      tenantId: 7,
      update: jest.fn().mockResolvedValue(undefined)
    };

    const failure = new Error("browser launch failed");
    mockInitializeError = failure;

    const initPromise = initWbot(whatsapp as any);

    await expect(initPromise).rejects.toThrow("browser launch failed");
  });
});
