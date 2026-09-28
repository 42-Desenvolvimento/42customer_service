const mockClientInstances: any[] = [];
const mockInitialize = jest.fn();
const mockEmit = jest.fn();

jest.mock("whatsapp-web.js", () => {
  const { EventEmitter } = require("events");

  return {
    DefaultOptions: {
      userAgent: "test-agent"
    },
    LocalAuth: jest.fn().mockImplementation(options => ({ options })),
    Client: jest.fn().mockImplementation(() => {
      const client = new EventEmitter();
      client.initialize = jest.fn(() => mockInitialize());
      client.destroy = jest.fn(() => Promise.resolve());
      client.getWWebVersion = jest.fn(() => Promise.resolve("2.0.0"));
      client.pupBrowser = {
        version: jest.fn(() => Promise.resolve("Chrome/Test"))
      };
      client.sendPresenceAvailable = jest.fn();
      mockClientInstances.push(client);
      return client;
    })
  };
});

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn(() => ({
    emit: mockEmit
  }))
}));

jest.mock("../../../services/WbotServices/SyncUnreadMessagesWbot", () =>
  jest.fn()
);

jest.mock("../../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn()
  }
}));

import { getWbot, initWbot, removeWbot } from "../../../libs/wbot";

const buildWhatsapp = (id = 123): any => ({
  id,
  name: "Main",
  tenantId: 7,
  status: "DISCONNECTED",
  retries: 0,
  session: null,
  update: jest.fn().mockResolvedValue(undefined)
});

describe("wbot session registry", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockClientInstances.splice(0);
    mockInitialize.mockResolvedValue(undefined);
    await removeWbot(123);
    await removeWbot(456);
  });

  afterEach(async () => {
    await removeWbot(123);
    await removeWbot(456);
  });

  it("removes a cached session even when destroying the client fails", async () => {
    const whatsapp = buildWhatsapp(123);
    const start = initWbot(whatsapp);
    const client = mockClientInstances[0];

    client.emit("ready");

    await expect(start).resolves.toBe(client);
    expect(getWbot(whatsapp.id)).toBe(client);

    client.destroy.mockRejectedValueOnce(new Error("destroy failed"));

    await removeWbot(whatsapp.id);

    expect(() => getWbot(whatsapp.id)).toThrow("ERR_WAPP_NOT_INITIALIZED");
  });

  it("rejects when the underlying client fails to initialize", async () => {
    const whatsapp = buildWhatsapp(456);

    mockInitialize.mockRejectedValueOnce(new Error("chrome failed"));

    await expect(initWbot(whatsapp)).rejects.toThrow("chrome failed");
  });
});
