const mockClientInstances: any[] = [];
const mockEmit = jest.fn();
const mockFindByPk = jest.fn();
let mockInitializeError: Error | null = null;

class MockClient {
  public id?: number;

  public info = { wid: { user: "5511999999999" } };

  public pupBrowser = { version: jest.fn().mockResolvedValue("Chrome/jest") };

  private handlers: Record<string, (...args: any[]) => any> = {};

  public initialize = jest.fn(() => {
    if (mockInitializeError) {
      return Promise.reject(mockInitializeError);
    }

    return Promise.resolve().then(() => {
      this.handlers.ready?.();
    });
  });

  public on = jest.fn((event: string, handler: (...args: any[]) => any) => {
    this.handlers[event] = handler;
    return this;
  });

  public destroy = jest.fn().mockResolvedValue(undefined);

  public getWWebVersion = jest.fn().mockResolvedValue("2.2409.2");

  public sendPresenceAvailable = jest.fn();
}

jest.mock("whatsapp-web.js", () => ({
  Client: jest.fn().mockImplementation(() => {
    const client = new MockClient();
    mockClientInstances.push(client);
    return client;
  }),
  LocalAuth: jest.fn().mockImplementation(() => ({})),
  DefaultOptions: { userAgent: "jest-user-agent" }
}));

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn(() => ({ emit: mockEmit }))
}));

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: {
    findByPk: mockFindByPk
  }
}));

jest.mock("../../../services/WbotServices/SyncUnreadMessagesWbot", () =>
  jest.fn()
);

jest.mock("../../../services/WbotServices/wbotMessageListener", () => ({
  wbotMessageListener: jest.fn()
}));

jest.mock("../../../services/WbotServices/wbotMonitor", () => jest.fn());

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

import { getWbot, initWbot, removeWbot } from "../../../libs/wbot";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { wbotMessageListener } from "../../../services/WbotServices/wbotMessageListener";
import wbotMonitor from "../../../services/WbotServices/wbotMonitor";

const createWhatsapp = (overrides: Record<string, any> = {}) => {
  const whatsapp: Record<string, any> = {
    id: 1,
    name: "Atendimento",
    tenantId: 1,
    type: "whatsapp",
    status: "CONNECTED",
    retries: 0,
    session: null,
    update: jest.fn(async (values: Record<string, any>) => {
      Object.assign(whatsapp, values);
      return whatsapp;
    }),
    ...overrides
  };

  return whatsapp as any;
};

describe("StartWhatsAppSession recovery", () => {
  afterEach(async () => {
    await removeWbot(1);
    await removeWbot(2);
    mockInitializeError = null;
    mockClientInstances.length = 0;
    jest.clearAllMocks();
  });

  it("replaces the registered client when sendSeen fails because the session disconnected", async () => {
    const originalWhatsapp = createWhatsapp();
    await initWbot(originalWhatsapp);

    expect(getWbot(1)).toBe(mockClientInstances[0]);

    const recoveredWhatsapp = createWhatsapp();
    mockFindByPk.mockResolvedValue(recoveredWhatsapp);

    await StartWhatsAppSessionVerify(
      1,
      new TypeError("Cannot read property 'sendSeen' of undefined")
    );

    expect(mockClientInstances).toHaveLength(2);
    expect(mockClientInstances[0].destroy).toHaveBeenCalledTimes(1);
    expect(getWbot(1)).toBe(mockClientInstances[1]);
    expect(wbotMessageListener).toHaveBeenCalledWith(mockClientInstances[1]);
    expect(wbotMonitor).toHaveBeenCalledWith(
      mockClientInstances[1],
      recoveredWhatsapp
    );
  });

  it("detaches a session from getWbot even if destroying the browser fails", async () => {
    const whatsapp = createWhatsapp({ id: 2 });
    await initWbot(whatsapp);

    const client = getWbot(2);
    client.destroy = jest.fn().mockRejectedValue(new Error("browser closed"));

    await removeWbot(2);

    expect(() => getWbot(2)).toThrow("ERR_WAPP_NOT_INITIALIZED");
  });

  it("rejects initWbot when the WhatsApp client fails to initialize", async () => {
    mockInitializeError = new Error("chrome failed");

    await expect(initWbot(createWhatsapp({ id: 2 }))).rejects.toThrow(
      "chrome failed"
    );

    expect(() => getWbot(2)).toThrow("ERR_WAPP_NOT_INITIALIZED");
  });
});
