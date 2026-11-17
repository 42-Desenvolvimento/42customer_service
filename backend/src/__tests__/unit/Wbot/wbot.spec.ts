const mockClientInstances: any[] = [];
let mockInitialize = jest.fn(() => Promise.resolve());

jest.mock("whatsapp-web.js", () => {
  class ClientMock {
    public handlers: Record<string, Function> = {};

    public id?: number;

    public info = { wid: { user: "5511999999999" } };

    public pupBrowser = {
      version: jest.fn().mockResolvedValue("Chrome/120")
    };

    public initialize = jest.fn(() => mockInitialize());

    public destroy = jest.fn().mockResolvedValue(undefined);

    public getWWebVersion = jest.fn().mockResolvedValue("2.2409.2");

    public sendPresenceAvailable = jest.fn();

    public on = jest.fn((event: string, callback: Function) => {
      this.handlers[event] = callback;
      return this;
    });
  }

  return {
    Client: jest.fn().mockImplementation(() => {
      const client = new ClientMock();
      mockClientInstances.push(client);
      return client;
    }),
    LocalAuth: jest.fn(),
    DefaultOptions: {
      userAgent: "test-agent"
    }
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
    info: jest.fn(),
    warn: jest.fn()
  }
}));

import { getWbot, initWbot, removeWbot } from "../../../libs/wbot";

const createWhatsapp = () => ({
  id: 42,
  name: "Atendimento",
  tenantId: 7,
  status: "OPENING",
  retries: 0,
  session: null,
  update: jest.fn()
});

describe("wbot session registry", () => {
  beforeEach(() => {
    mockClientInstances.length = 0;
    mockInitialize = jest.fn(() => Promise.resolve());
    jest.clearAllMocks();
  });

  it("removes a session from the registry even when destroy fails", async () => {
    const whatsapp = createWhatsapp();
    const initPromise = initWbot(whatsapp as any);

    await mockClientInstances[0].handlers.ready();
    const firstClient = await initPromise;
    expect(getWbot(whatsapp.id)).toBe(firstClient);

    firstClient.destroy = jest
      .fn()
      .mockRejectedValue(new Error("destroy failed"));

    await removeWbot(whatsapp.id);

    expect(() => getWbot(whatsapp.id)).toThrow("ERR_WAPP_NOT_INITIALIZED");
  });

  it("rejects initialization when whatsapp-web.js initialize fails", async () => {
    mockInitialize = jest.fn(() => Promise.reject(new Error("chrome failed")));

    await expect(initWbot(createWhatsapp() as any)).rejects.toThrow(
      "chrome failed"
    );
  });
});
