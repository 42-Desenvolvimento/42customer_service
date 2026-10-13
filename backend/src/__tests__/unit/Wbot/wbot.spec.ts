const mockEventHandlers: Record<string, () => Promise<void> | void> = {};
const mockDestroy = jest.fn();
const mockGetWWebVersion = jest.fn();
const mockInitialize = jest.fn();
const mockOn = jest.fn((event: string, callback: () => Promise<void> | void) => {
  mockEventHandlers[event] = callback;
});
const mockSendPresenceAvailable = jest.fn();

jest.mock("whatsapp-web.js", () => ({
  Client: jest.fn().mockImplementation(() => ({
    destroy: mockDestroy,
    getWWebVersion: mockGetWWebVersion,
    info: { wid: { user: "5511999999999" } },
    initialize: mockInitialize,
    on: mockOn,
    pupBrowser: { version: jest.fn().mockResolvedValue("Chrome/120") },
    sendPresenceAvailable: mockSendPresenceAvailable
  })),
  DefaultOptions: { userAgent: "test-agent" },
  LocalAuth: jest.fn()
}));

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn(() => ({ emit: jest.fn() }))
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

import AppError from "../../../errors/AppError";
import { getWbot, initWbot, removeWbot } from "../../../libs/wbot";

describe("wbot session registry", () => {
  beforeEach(() => {
    Object.keys(mockEventHandlers).forEach(key => delete mockEventHandlers[key]);
    mockDestroy.mockReset();
    mockDestroy.mockResolvedValue(undefined);
    mockGetWWebVersion.mockReset();
    mockGetWWebVersion.mockResolvedValue("2.2409.2");
    mockInitialize.mockReset();
    mockInitialize.mockResolvedValue(undefined);
    mockOn.mockClear();
    mockSendPresenceAvailable.mockClear();
  });

  it("removes a session from the registry even when destroy fails", async () => {
    const whatsapp = {
      id: 42,
      name: "session",
      tenantId: 7,
      update: jest.fn().mockResolvedValue(undefined)
    };

    const ready = initWbot(whatsapp as any);
    await mockEventHandlers.ready();
    await ready;

    expect(getWbot(42).id).toBe(42);

    mockDestroy.mockRejectedValueOnce(new Error("destroy failed"));
    await removeWbot(42);

    expect(() => getWbot(42)).toThrow(AppError);
  });

  it("rejects when whatsapp-web.js fails during initialize", async () => {
    mockInitialize.mockRejectedValueOnce(new Error("initialize failed"));

    await expect(
      initWbot({
        id: 77,
        name: "broken",
        tenantId: 7,
        update: jest.fn()
      } as any)
    ).rejects.toThrow("initialize failed");
  });
});
