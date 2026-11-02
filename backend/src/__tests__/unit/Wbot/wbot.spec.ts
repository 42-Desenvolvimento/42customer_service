const mockHandlers: Record<string, (...args: any[]) => any> = {};
const mockInitialize = jest.fn();
const mockDestroy = jest.fn();
const mockSendPresenceAvailable = jest.fn();
const mockGetWWebVersion = jest.fn();
const mockBrowserVersion = jest.fn();
const mockEmit = jest.fn();
const mockSyncUnreadMessagesWbot = jest.fn();

const mockCreateClient = () => {
  const client: any = {
    info: { wid: { user: "5511999999999" } },
    pupBrowser: { version: mockBrowserVersion },
    initialize: mockInitialize,
    destroy: mockDestroy,
    sendPresenceAvailable: mockSendPresenceAvailable,
    getWWebVersion: mockGetWWebVersion
  };

  client.on = jest.fn((event: string, handler: (...args: any[]) => any) => {
    mockHandlers[event] = handler;
    return client;
  });

  return client;
};

jest.mock("whatsapp-web.js", () => ({
  Client: jest.fn().mockImplementation(() => mockCreateClient()),
  LocalAuth: jest.fn().mockImplementation(options => options),
  DefaultOptions: { userAgent: "mock-user-agent" }
}));

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn(() => ({
    emit: mockEmit
  }))
}));

jest.mock("../../../services/WbotServices/SyncUnreadMessagesWbot", () => ({
  __esModule: true,
  default: mockSyncUnreadMessagesWbot
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

import { getWbot, initWbot, removeWbot } from "../../../libs/wbot";

describe("wbot session registry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(mockHandlers).forEach(key => delete mockHandlers[key]);
    mockInitialize.mockReturnValue(Promise.resolve());
    mockDestroy.mockResolvedValue(undefined);
    mockGetWWebVersion.mockResolvedValue("2.2409.2");
    mockBrowserVersion.mockResolvedValue("Chrome/120");
  });

  it("rejects initWbot when the WhatsApp client initialization fails", async () => {
    mockInitialize.mockReturnValue(Promise.reject(new Error("browser failed")));

    await expect(
      initWbot({
        id: 31,
        name: "session-31",
        tenantId: 9
      } as any)
    ).rejects.toThrow("browser failed");
  });

  it("removes a session from the registry before waiting for destroy", async () => {
    const whatsapp = {
      id: 21,
      name: "session-21",
      tenantId: 4,
      update: jest.fn().mockResolvedValue(undefined)
    };

    const initPromise = initWbot(whatsapp as any);
    await mockHandlers.ready();
    const session = await initPromise;

    expect(getWbot(21)).toBe(session);

    let destroyResolve: (() => void) | undefined;
    mockDestroy.mockReturnValue(
      new Promise<void>(resolve => {
        destroyResolve = resolve;
      })
    );

    const removePromise = removeWbot(21);

    expect(() => getWbot(21)).toThrow("ERR_WAPP_NOT_INITIALIZED");
    expect(mockDestroy).toHaveBeenCalledTimes(1);

    destroyResolve?.();
    await removePromise;
  });
});
