jest.mock("whatsapp-web.js", () => {
  const mockClientInstances: any[] = [];

  class MockClient {
    public static nextInitializeResult: Promise<void> | null = null;

    public id?: number;

    public handlers: Record<string, Function> = {};

    public info = { wid: { user: "5511999999999" } };

    public pupBrowser = {
      version: jest.fn().mockResolvedValue("mock-browser")
    };

    public initialize = jest.fn(() => {
      return MockClient.nextInitializeResult || Promise.resolve();
    });

    public on = jest.fn((event: string, handler: Function) => {
      this.handlers[event] = handler;
      return this;
    });

    public destroy = jest.fn().mockResolvedValue(undefined);

    public getWWebVersion = jest.fn().mockResolvedValue("mock-web-version");

    public sendPresenceAvailable = jest.fn();

    constructor() {
      mockClientInstances.push(this);
    }
  }

  return {
    Client: MockClient,
    LocalAuth: jest.fn(),
    DefaultOptions: { userAgent: "mock-user-agent" },
    __mockClientInstances: mockClientInstances
  };
});

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn(() => ({ emit: jest.fn() }))
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

describe("wbot session registry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("removes the registered session before awaiting destroy", async () => {
    const { initWbot, getWbot, removeWbot } = await import("../../../libs/wbot");
    const whatsapp = {
      id: 42,
      name: "Suporte",
      tenantId: 7,
      status: "OPENING",
      session: null,
      update: jest.fn().mockResolvedValue(undefined)
    };

    const initPromise = initWbot(whatsapp as any);
    const { __mockClientInstances } = require("whatsapp-web.js");
    const client = __mockClientInstances[0];
    client.destroy.mockRejectedValueOnce(new Error("browser already closed"));

    await client.handlers.ready();
    await initPromise;

    expect(getWbot(whatsapp.id)).toBe(client);

    await removeWbot(whatsapp.id);

    expect(() => getWbot(whatsapp.id)).toThrow("ERR_WAPP_NOT_INITIALIZED");
  });

  it("rejects when client initialization fails", async () => {
    jest.resetModules();
    const whatsappWeb = require("whatsapp-web.js");
    whatsappWeb.Client.nextInitializeResult = Promise.reject(
      new Error("chrome failed")
    );

    const { initWbot } = await import("../../../libs/wbot");
    const whatsapp = {
      id: 43,
      name: "Suporte 2",
      tenantId: 7,
      status: "OPENING",
      session: null,
      update: jest.fn()
    };

    await expect(initWbot(whatsapp as any)).rejects.toThrow("chrome failed");

    whatsappWeb.Client.nextInitializeResult = null;
  });
});
