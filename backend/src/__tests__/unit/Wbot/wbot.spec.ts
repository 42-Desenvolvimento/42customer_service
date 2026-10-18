const mockClients: any[] = [];
let mockInitializeImpl: () => Promise<void>;
let mockDestroyImpl: () => Promise<void>;

jest.mock("whatsapp-web.js", () => {
  const { EventEmitter } = require("events");

  return {
    Client: jest.fn().mockImplementation(() => {
      const client = new EventEmitter();

      client.initialize = jest.fn(() => mockInitializeImpl());
      client.destroy = jest.fn(() => mockDestroyImpl());
      client.getWWebVersion = jest.fn().mockResolvedValue("2.2409.2");
      client.pupBrowser = {
        version: jest.fn().mockResolvedValue("Chrome/120")
      };
      client.sendPresenceAvailable = jest.fn();
      client.info = {
        wid: {
          user: "5511999999999"
        }
      };

      mockClients.push(client);
      return client;
    }),
    LocalAuth: jest.fn().mockImplementation(() => ({})),
    DefaultOptions: {
      userAgent: "test-agent"
    }
  };
});

jest.mock("../../../../src/libs/socket", () => ({
  getIO: jest.fn(() => ({
    emit: jest.fn()
  }))
}));

jest.mock("../../../services/WbotServices/SyncUnreadMessagesWbot", () =>
  jest.fn()
);

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn()
  }
}));

import { initWbot, getWbot, removeWbot } from "../../../libs/wbot";

describe("wbot session registry", () => {
  beforeEach(() => {
    mockClients.length = 0;
    mockInitializeImpl = () => Promise.resolve();
    mockDestroyImpl = () => Promise.resolve();
  });

  it("remove a sessao da lista mesmo quando destroy falha", async () => {
    const whatsapp = {
      id: 12,
      name: "principal",
      tenantId: 3,
      status: "OPENING",
      update: jest.fn().mockResolvedValue(undefined)
    };

    const startPromise = initWbot(whatsapp as any);
    const client = mockClients[0];
    client.emit("ready");
    await startPromise;

    expect(getWbot(whatsapp.id)).toBe(client);

    mockDestroyImpl = () => Promise.reject(new Error("destroy failed"));
    await removeWbot(whatsapp.id);

    expect(() => getWbot(whatsapp.id)).toThrow("ERR_WAPP_NOT_INITIALIZED");
  });

  it("rejeita quando o initialize do client falha", async () => {
    mockInitializeImpl = () => Promise.reject(new Error("chrome failed"));

    await expect(
      initWbot({
        id: 13,
        name: "secundaria",
        tenantId: 3,
        update: jest.fn()
      } as any)
    ).rejects.toThrow("chrome failed");
  });
});
