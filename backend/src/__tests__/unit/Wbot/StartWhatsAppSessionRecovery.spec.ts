const mockClientInstances: any[] = [];

jest.mock("whatsapp-web.js", () => {
  class MockClient {
    id?: number;

    info = { wid: { user: "5511999999999" } };

    pupBrowser = {
      version: jest.fn().mockResolvedValue("mock-browser")
    };

    handlers: Record<string, (...args: any[]) => any> = {};

    destroy = jest.fn().mockResolvedValue(undefined);

    getWWebVersion = jest.fn().mockResolvedValue("mock-wweb");

    initialize = jest.fn().mockResolvedValue(undefined);

    sendPresenceAvailable = jest.fn();

    constructor() {
      mockClientInstances.push(this);
    }

    on(event: string, handler: (...args: any[]) => any) {
      this.handlers[event] = handler;
      return this;
    }
  }

  return {
    Client: MockClient,
    DefaultOptions: { userAgent: "jest-user-agent" },
    LocalAuth: jest.fn()
  };
});

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn(() => ({ emit: jest.fn() }))
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

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: {
    findByPk: jest.fn()
  }
}));

import Whatsapp from "../../../models/Whatsapp";
import { getWbot, initWbot, removeWbot } from "../../../libs/wbot";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { wbotMessageListener } from "../../../services/WbotServices/wbotMessageListener";
import wbotMonitor from "../../../services/WbotServices/wbotMonitor";

const buildWhatsapp = () =>
  ({
    id: 42,
    name: "Support",
    tenantId: 7,
    session: null,
    status: "CONNECTED",
    retries: 0,
    update: jest.fn().mockResolvedValue(undefined)
  } as any);

const flushPromises = async (times = 5): Promise<void> => {
  for (let index = 0; index < times; index += 1) {
    await new Promise(resolve => setImmediate(resolve));
  }
};

describe("WhatsApp session recovery", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await removeWbot(42);
    mockClientInstances.length = 0;
  });

  afterEach(async () => {
    await removeWbot(42);
    mockClientInstances.length = 0;
  });

  it("removes a stale session before registering the recovered client", async () => {
    const staleWhatsapp = buildWhatsapp();
    const staleSessionPromise = initWbot(staleWhatsapp);
    const staleClient = mockClientInstances[0];

    await staleClient.handlers.ready();
    await staleSessionPromise;

    expect(getWbot(42)).toBe(staleClient);

    const recoveredWhatsapp = buildWhatsapp();
    (Whatsapp.findByPk as jest.Mock).mockResolvedValue(recoveredWhatsapp);

    const recoveryPromise = StartWhatsAppSessionVerify(
      42,
      "TypeError: Cannot read property 'sendSeen' of undefined"
    );

    await flushPromises();

    const recoveredClient = mockClientInstances[1];
    expect(recoveredClient).toBeDefined();

    await recoveredClient.handlers.ready();
    await recoveryPromise;

    expect(staleClient.destroy).toHaveBeenCalledTimes(1);
    expect(getWbot(42)).toBe(recoveredClient);
    expect(getWbot(42)).not.toBe(staleClient);
    expect(wbotMessageListener).toHaveBeenCalledWith(recoveredClient);
    expect(wbotMonitor).toHaveBeenCalledWith(recoveredClient, recoveredWhatsapp);
  });
});
