const mockHandlers: Record<string, (...args: any[]) => Promise<void> | void> = {};
const mockDestroy = jest.fn();
const mockInitialize = jest.fn();
const mockGetWWebVersion = jest.fn();
const mockBrowserVersion = jest.fn();
const mockSendPresenceAvailable = jest.fn();

jest.mock("whatsapp-web.js", () => {
  class MockClient {
    id?: number;

    info = { wid: { user: "5511999999999" } };

    pupBrowser = { version: mockBrowserVersion };

    initialize = mockInitialize;

    destroy = mockDestroy;

    getWWebVersion = mockGetWWebVersion;

    sendPresenceAvailable = mockSendPresenceAvailable;

    on(event: string, handler: (...args: any[]) => Promise<void> | void) {
      mockHandlers[event] = handler;
      return this;
    }
  }

  return {
    Client: MockClient,
    LocalAuth: jest.fn(),
    DefaultOptions: {
      userAgent: "mock-user-agent"
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
import Whatsapp from "../../../models/Whatsapp";

const buildWhatsapp = () =>
  ({
    id: 42,
    name: "main",
    tenantId: 7,
    status: "OPENING",
    retries: 0,
    update: jest.fn().mockResolvedValue(undefined)
  } as unknown as Whatsapp);

describe("wbot session registry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(mockHandlers).forEach(key => {
      delete mockHandlers[key];
    });
    mockInitialize.mockResolvedValue(undefined);
    mockDestroy.mockResolvedValue(undefined);
    mockGetWWebVersion.mockResolvedValue("2.2409.2");
    mockBrowserVersion.mockResolvedValue("Chrome/120");
  });

  it("removes a session from the registry before waiting for destroy", async () => {
    const whatsapp = buildWhatsapp();
    const sessionPromise = initWbot(whatsapp);

    await mockHandlers.ready();
    const session = await sessionPromise;
    expect(getWbot(whatsapp.id)).toBe(session);

    let finishDestroy!: () => void;
    mockDestroy.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          finishDestroy = resolve;
        })
    );

    const removal = removeWbot(whatsapp.id);

    expect(() => getWbot(whatsapp.id)).toThrow("ERR_WAPP_NOT_INITIALIZED");

    finishDestroy();
    await removal;

    expect(mockDestroy).toHaveBeenCalledTimes(1);
  });

  it("rejects initialization when whatsapp-web initialize fails", async () => {
    const initializeError = new Error("chrome failed");
    mockInitialize.mockRejectedValueOnce(initializeError);

    await expect(initWbot(buildWhatsapp())).rejects.toThrow("chrome failed");
  });
});
