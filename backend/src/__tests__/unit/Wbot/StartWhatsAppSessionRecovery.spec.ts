const mockSocketEmit = jest.fn();

const mockLogger = {
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn()
};

const mockWbotMessageListener = jest.fn();
const mockWbotMonitor = jest.fn();

const mockChannelServices = (): void => {
  jest.doMock(
    "../../../services/InstagramBotServices/StartInstaBotSession",
    () => ({
      StartInstaBotSession: jest.fn()
    })
  );
  jest.doMock("../../../services/TbotServices/StartTbotSession", () => ({
    StartTbotSession: jest.fn()
  }));
  jest.doMock("../../../services/WABA360/StartWaba360", () => ({
    StartWaba360: jest.fn()
  }));
  jest.doMock(
    "../../../services/MessengerChannelServices/StartMessengerBot",
    () => ({
      StartMessengerBot: jest.fn()
    })
  );
};

const mockCommonServices = (): void => {
  mockSocketEmit.mockClear();
  mockLogger.error.mockClear();
  mockLogger.info.mockClear();
  mockLogger.warn.mockClear();
  mockWbotMessageListener.mockClear();
  mockWbotMonitor.mockClear();

  jest.doMock("../../../libs/socket", () => ({
    getIO: () => ({ emit: mockSocketEmit })
  }));
  jest.doMock("../../../utils/logger", () => ({
    logger: mockLogger
  }));
  jest.doMock("../../../services/WbotServices/wbotMessageListener", () => ({
    wbotMessageListener: mockWbotMessageListener
  }));
  jest.doMock("../../../services/WbotServices/wbotMonitor", () => ({
    __esModule: true,
    default: mockWbotMonitor
  }));
};

describe("WhatsApp session recovery", () => {
  beforeEach(() => {
    jest.resetModules();
    mockCommonServices();
  });

  it("removes the stale session before reopening after sendSeen disconnects", async () => {
    const whatsapp = {
      id: 42,
      tenantId: 7,
      update: jest.fn().mockResolvedValue(undefined)
    };
    const wbot = { id: 42 };
    const removeWbot = jest.fn().mockResolvedValue(undefined);
    const initWbot = jest.fn().mockResolvedValue(wbot);
    const findByPk = jest.fn().mockResolvedValue(whatsapp);

    jest.doMock("../../../libs/wbot", () => ({ initWbot, removeWbot }));
    jest.doMock("../../../models/Whatsapp", () => ({
      __esModule: true,
      default: { findByPk }
    }));

    const { StartWhatsAppSessionVerify } = await import(
      "../../../services/WbotServices/StartWhatsAppSessionVerify"
    );

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      new TypeError("Cannot read property 'sendSeen' of undefined")
    );

    expect(findByPk).toHaveBeenCalledWith(whatsapp.id);
    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(removeWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(initWbot).toHaveBeenCalledWith(whatsapp);
    expect(removeWbot.mock.invocationCallOrder[0]).toBeLessThan(
      initWbot.mock.invocationCallOrder[0]
    );
    expect(mockWbotMessageListener).toHaveBeenCalledWith(wbot);
    expect(mockWbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);
  });

  it("removes any existing WhatsApp client before starting a session", async () => {
    mockChannelServices();

    const whatsapp = {
      id: 43,
      tenantId: 8,
      type: "whatsapp",
      update: jest.fn().mockResolvedValue(undefined)
    };
    const wbot = { id: 43 };
    const removeWbot = jest.fn().mockResolvedValue(undefined);
    const initWbot = jest.fn().mockResolvedValue(wbot);

    jest.doMock("../../../libs/wbot", () => ({ initWbot, removeWbot }));

    const { StartWhatsAppSession } = await import(
      "../../../services/WbotServices/StartWhatsAppSession"
    );

    await StartWhatsAppSession(whatsapp as any);

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(removeWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(initWbot).toHaveBeenCalledWith(whatsapp);
    expect(removeWbot.mock.invocationCallOrder[0]).toBeLessThan(
      initWbot.mock.invocationCallOrder[0]
    );
    expect(mockWbotMessageListener).toHaveBeenCalledWith(wbot);
    expect(mockWbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);
  });
});

describe("wbot registry", () => {
  beforeEach(() => {
    jest.resetModules();
    mockCommonServices();
  });

  const setupWbotModule = async (
    mockInitializeImpl: () => Promise<void> = () => Promise.resolve()
  ) => {
    jest.dontMock("../../../libs/wbot");
    jest.doMock("../../../services/WbotServices/SyncUnreadMessagesWbot", () =>
      jest.fn()
    );
    jest.doMock("whatsapp-web.js", () => {
      const { EventEmitter } = require("events");

      class MockClient extends EventEmitter {
        public id?: number;

        public info = { wid: { user: "5511999999999" } };

        public pupBrowser = {
          version: jest.fn().mockResolvedValue("Chrome/120")
        };

        public initialize = jest.fn(mockInitializeImpl);

        public destroy = jest.fn().mockResolvedValue(undefined);

        public getWWebVersion = jest.fn().mockResolvedValue("2.2409.2");

        public sendPresenceAvailable = jest.fn();
      }

      const instances: MockClient[] = [];
      const Client = jest.fn().mockImplementation(() => {
        const client = new MockClient();
        instances.push(client);
        return client;
      });
      (Client as any).instances = instances;

      return {
        Client,
        LocalAuth: jest.fn(),
        DefaultOptions: { userAgent: "test-agent" }
      };
    });

    const wbotModule = await import("../../../libs/wbot");
    const whatsappWeb = await import("whatsapp-web.js");

    return {
      ...wbotModule,
      clientInstances: (whatsappWeb.Client as any).instances
    };
  };

  const buildWhatsapp = (id = 44) =>
    ({
      id,
      tenantId: 9,
      name: `session-${id}`,
      status: "OPENING",
      retries: 0,
      update: jest.fn().mockResolvedValue(undefined)
    } as any);

  it("removes a session from the registry before waiting for destroy", async () => {
    const { initWbot, removeWbot, getWbot, clientInstances } =
      await setupWbotModule();
    const whatsapp = buildWhatsapp();

    const initPromise = initWbot(whatsapp);
    await Promise.resolve();

    const client = clientInstances[0];
    client.emit("ready");
    await initPromise;

    expect(getWbot(whatsapp.id)).toBe(client);

    let resolveDestroy: () => void;
    client.destroy.mockImplementation(
      () =>
        new Promise<void>(resolve => {
          resolveDestroy = resolve;
        })
    );

    const removePromise = removeWbot(whatsapp.id);
    await Promise.resolve();

    expect(() => getWbot(whatsapp.id)).toThrow("ERR_WAPP_NOT_INITIALIZED");

    resolveDestroy!();
    await removePromise;
    expect(client.destroy).toHaveBeenCalled();
  });

  it("rejects initWbot when whatsapp-web initialization fails", async () => {
    const initializeError = new Error("browser failed");
    const { initWbot } = await setupWbotModule(() =>
      Promise.reject(initializeError)
    );

    await expect(initWbot(buildWhatsapp(45))).rejects.toThrow("browser failed");
  });
});
