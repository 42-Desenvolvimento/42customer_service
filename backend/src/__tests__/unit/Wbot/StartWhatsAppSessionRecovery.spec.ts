const mockClientInstances: any[] = [];
let mockInitializeImplementation:
  | ((client: any) => Promise<void>)
  | undefined;

const mockEmit = jest.fn();
const mockFindByPk = jest.fn();

jest.mock("whatsapp-web.js", () => {
  class MockClient {
    public id?: number;

    public info = { wid: { user: "5511999999999" } };

    public pupBrowser = {
      version: jest.fn().mockResolvedValue("Chrome/test")
    };

    public handlers: Record<string, Array<(...args: any[]) => any>> = {};

    public destroy = jest.fn().mockResolvedValue(undefined);

    public getWWebVersion = jest.fn().mockResolvedValue("2.0.0-test");

    public sendPresenceAvailable = jest.fn();

    public initialize = jest.fn(() => {
      if (mockInitializeImplementation) {
        return mockInitializeImplementation(this);
      }

      return new Promise<void>(resolve => {
        setImmediate(async () => {
          await this.emitEvent("ready");
          resolve();
        });
      });
    });

    public on(event: string, handler: (...args: any[]) => any): this {
      this.handlers[event] = this.handlers[event] || [];
      this.handlers[event].push(handler);
      return this;
    }

    public async emitEvent(event: string, ...args: any[]): Promise<void> {
      const handlers = this.handlers[event] || [];
      await Promise.all(handlers.map(handler => handler(...args)));
    }
  }

  return {
    Client: jest.fn().mockImplementation(() => {
      const client = new MockClient();
      mockClientInstances.push(client);
      return client;
    }),
    LocalAuth: jest.fn().mockImplementation(options => ({ options })),
    DefaultOptions: { userAgent: "test-agent" }
  };
});

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn(() => ({ emit: mockEmit }))
}));

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: {
    findByPk: mockFindByPk
  }
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

jest.mock("../../../services/WbotServices/SyncUnreadMessagesWbot", () =>
  jest.fn()
);

jest.mock("../../../services/WbotServices/wbotMessageListener", () => ({
  wbotMessageListener: jest.fn()
}));

jest.mock("../../../services/WbotServices/wbotMonitor", () => jest.fn());

import { getWbot, initWbot, removeWbot } from "../../../libs/wbot";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

const makeWhatsapp = () => {
  const whatsapp: any = {
    id: 1,
    name: "Suporte",
    tenantId: 10,
    type: "whatsapp",
    status: "CONNECTED",
    retries: 0,
    session: null,
    update: jest.fn(async (data: Record<string, unknown>) => {
      Object.assign(whatsapp, data);
      return whatsapp;
    })
  };

  return whatsapp;
};

describe("WhatsApp session recovery", () => {
  beforeEach(async () => {
    await removeWbot(1);
    mockClientInstances.length = 0;
    mockInitializeImplementation = undefined;
    mockEmit.mockClear();
    mockFindByPk.mockReset();
  });

  afterEach(async () => {
    await removeWbot(1);
  });

  it("replaces a stale registered session when sendSeen reports a disconnected client", async () => {
    const whatsapp = makeWhatsapp();
    const staleSession = await initWbot(whatsapp);

    mockFindByPk.mockResolvedValue(whatsapp);

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      new TypeError("Cannot read property 'sendSeen' of undefined")
    );

    const recoveredSession = getWbot(whatsapp.id);

    expect(mockClientInstances).toHaveLength(2);
    expect(staleSession.destroy).toHaveBeenCalledTimes(1);
    expect(recoveredSession).toBe(mockClientInstances[1]);
    expect(recoveredSession).not.toBe(staleSession);
  });

  it("removes a session from the registry even if destroy fails synchronously", async () => {
    const whatsapp = makeWhatsapp();
    const session = await initWbot(whatsapp);
    session.destroy = jest.fn(() => {
      throw new Error("destroy failed");
    }) as any;

    await removeWbot(whatsapp.id);

    expect(() => getWbot(whatsapp.id)).toThrow("ERR_WAPP_NOT_INITIALIZED");
  });

  it("rejects startup when the underlying whatsapp client cannot initialize", async () => {
    mockInitializeImplementation = () =>
      Promise.reject(new Error("launch failed"));

    await expect(initWbot(makeWhatsapp())).rejects.toThrow(
      "Error starting whatsapp session."
    );
  });
});
