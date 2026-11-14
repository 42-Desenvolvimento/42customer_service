const mockClients: any[] = [];
const mockEmit = jest.fn();
const mockSyncUnreadMessagesWbot = jest.fn();

jest.mock("whatsapp-web.js", () => {
  const { EventEmitter } = require("events");

  return {
    Client: jest.fn().mockImplementation(() => {
      const client = new EventEmitter();
      client.info = { wid: { user: "5511999999999" } };
      client.pupBrowser = { version: jest.fn().mockResolvedValue("browser") };
      client.getWWebVersion = jest.fn().mockResolvedValue("web");
      client.sendPresenceAvailable = jest.fn();
      client.initialize = jest.fn().mockResolvedValue(undefined);
      client.destroy = jest.fn().mockResolvedValue(undefined);
      mockClients.push(client);
      return client;
    }),
    LocalAuth: jest.fn(),
    DefaultOptions: { userAgent: "test-agent" }
  };
});

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn(() => ({ emit: mockEmit }))
}));

jest.mock("../../../services/WbotServices/SyncUnreadMessagesWbot", () => ({
  __esModule: true,
  default: mockSyncUnreadMessagesWbot
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

import { getWbot, initWbot, removeWbot } from "../../../libs/wbot";

describe("wbot session registry", () => {
  beforeEach(() => {
    mockClients.length = 0;
    jest.clearAllMocks();
  });

  it("removes a session from the registry even when client destroy fails", async () => {
    const whatsapp = {
      id: 7,
      name: "Main",
      tenantId: 2,
      status: "DISCONNECTED",
      session: null,
      update: jest.fn().mockResolvedValue(undefined)
    };

    const initPromise = initWbot(whatsapp as any);
    const firstClient = mockClients[0];

    firstClient.emit("ready");
    await expect(initPromise).resolves.toBe(firstClient);
    expect(getWbot(7)).toBe(firstClient);

    firstClient.destroy.mockImplementation(() => {
      throw new Error("destroy failed");
    });

    await removeWbot(7);

    expect(() => getWbot(7)).toThrow("ERR_WAPP_NOT_INITIALIZED");
  });
});
