const mockHandlers: Record<string, (...args: any[]) => any> = {};
const mockDestroy = jest.fn();
const mockInitialize = jest.fn();
const mockGetWWebVersion = jest.fn();
const mockBrowserVersion = jest.fn();

jest.mock("whatsapp-web.js", () => ({
  DefaultOptions: {
    userAgent: "jest-user-agent"
  },
  LocalAuth: jest.fn().mockImplementation(config => config),
  Client: jest.fn().mockImplementation(() => {
    const client = {
      id: 0,
      info: {
        wid: {
          user: "5511999999999"
        }
      },
      pupBrowser: {
        version: mockBrowserVersion
      },
      destroy: mockDestroy,
      getWWebVersion: mockGetWWebVersion,
      initialize: mockInitialize,
      on: jest.fn((event: string, handler: (...args: any[]) => any) => {
        mockHandlers[event] = handler;
        return client;
      }),
      sendPresenceAvailable: jest.fn()
    };

    return client;
  })
}));

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn(() => ({
    emit: jest.fn()
  }))
}));

jest.mock("../../../services/WbotServices/SyncUnreadMessagesWbot", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn()
  }
}));

import { getWbot, initWbot, removeWbot } from "../../../libs/wbot";

describe("wbot session registry", () => {
  beforeEach(() => {
    Object.keys(mockHandlers).forEach(key => delete mockHandlers[key]);
    jest.clearAllMocks();
    mockInitialize.mockResolvedValue(undefined);
    mockDestroy.mockResolvedValue(undefined);
    mockGetWWebVersion.mockResolvedValue("2.2409.2");
    mockBrowserVersion.mockResolvedValue("Chrome/123");
  });

  it("removes the cached session even when client destroy fails", async () => {
    const whatsapp = {
      id: 99,
      name: "support",
      tenantId: 1,
      session: "",
      status: "OPENING",
      update: jest.fn().mockResolvedValue(undefined)
    } as any;

    const initPromise = initWbot(whatsapp);
    await mockHandlers.ready();
    await initPromise;

    expect(getWbot(whatsapp.id)).toHaveProperty("id", whatsapp.id);

    mockDestroy.mockRejectedValueOnce(new Error("browser already closed"));

    await removeWbot(whatsapp.id);

    expect(() => getWbot(whatsapp.id)).toThrow("ERR_WAPP_NOT_INITIALIZED");
  });

  it("rejects when initialize fails instead of leaving callers waiting", async () => {
    const whatsapp = {
      id: 100,
      name: "support",
      tenantId: 1,
      session: "",
      status: "OPENING",
      update: jest.fn().mockResolvedValue(undefined)
    } as any;
    const error = new Error("chromium failed");
    mockInitialize.mockRejectedValueOnce(error);

    await expect(initWbot(whatsapp)).rejects.toThrow(error);
  });
});
