const mockEmit = jest.fn();

class MockClient {
  public id?: number;

  public info = { wid: { user: "5511999999999" } };

  public pupBrowser = {
    version: jest.fn().mockResolvedValue("Chrome/123")
  };

  private handlers: Record<string, (...args: any[]) => void | Promise<void>> =
    {};

  public on = jest.fn(
    (event: string, handler: (...args: any[]) => void | Promise<void>) => {
      this.handlers[event] = handler;
      return this;
    }
  );

  public initialize = jest.fn(() => {
    setImmediate(() => {
      this.handlers.ready?.();
    });
    return Promise.resolve();
  });

  public destroy = jest.fn().mockResolvedValue(undefined);

  public getWWebVersion = jest.fn().mockResolvedValue("2.2409.2");

  public sendPresenceAvailable = jest.fn();
}

jest.mock("whatsapp-web.js", () => ({
  Client: jest.fn().mockImplementation(() => new MockClient()),
  LocalAuth: jest.fn().mockImplementation(config => config),
  DefaultOptions: {
    userAgent: "test-agent"
  }
}));

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn(() => ({ emit: mockEmit }))
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

import { getWbot, initWbot, removeWbot } from "../../../libs/wbot";

describe("wbot session registry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await removeWbot(123);
  });

  const buildWhatsapp = (id = 123): any => {
    const whatsapp = {
      id,
      name: "Atendimento",
      tenantId: 456,
      status: "OPENING",
      retries: 0,
      session: null,
      update: jest.fn(async values => {
        Object.assign(whatsapp, values);
      })
    };

    return whatsapp;
  };

  it("removes the stale session before waiting for destroy to finish", async () => {
    const whatsapp = buildWhatsapp();
    const session = await initWbot(whatsapp);
    let finishDestroy!: () => void;

    session.destroy = jest.fn(
      () =>
        new Promise<void>(resolve => {
          finishDestroy = resolve;
        })
    ) as any;

    const removePromise = removeWbot(whatsapp.id);

    expect(() => getWbot(whatsapp.id)).toThrow("ERR_WAPP_NOT_INITIALIZED");

    finishDestroy();
    await removePromise;
  });
});
