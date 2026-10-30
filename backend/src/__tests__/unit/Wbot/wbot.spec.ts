const mockEmit = jest.fn();
const mockSyncUnreadMessagesWbot = jest.fn();
const mockClients: MockClient[] = [];

class MockClient {
  id?: number;
  handlers: Record<string, (...args: any[]) => Promise<void> | void> = {};
  destroy = jest.fn().mockResolvedValue(undefined);
  initialize = jest.fn().mockResolvedValue(undefined);
  getWWebVersion = jest.fn().mockResolvedValue("2.2409.2");
  sendPresenceAvailable = jest.fn();
  info = { wid: { user: "5511999999999" } };
  pupBrowser = {
    version: jest.fn().mockResolvedValue("Chrome/120")
  };

  constructor() {
    mockClients.push(this);
  }

  on(event: string, handler: (...args: any[]) => Promise<void> | void): void {
    this.handlers[event] = handler;
  }
}

jest.mock("whatsapp-web.js", () => ({
  Client: MockClient,
  LocalAuth: jest.fn(),
  DefaultOptions: {
    userAgent: "test-agent"
  }
}));

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn(() => ({ emit: mockEmit }))
}));

jest.mock("../../../services/WbotServices/SyncUnreadMessagesWbot", () => ({
  __esModule: true,
  default: mockSyncUnreadMessagesWbot
}));

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: class Whatsapp {}
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

import AppError from "../../../errors/AppError";
import { getWbot, initWbot, removeWbot } from "../../../libs/wbot";

describe("wbot session registry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClients.length = 0;
  });

  const buildWhatsapp = () =>
    ({
      id: 10,
      name: "Main",
      tenantId: 3,
      status: "OPENING",
      update: jest.fn().mockResolvedValue(undefined)
    } as any);

  it("removes a stale session before registering a replacement client", async () => {
    const firstWhatsapp = buildWhatsapp();
    const firstInit = initWbot(firstWhatsapp);

    await mockClients[0].handlers.ready();
    const firstClient = await firstInit;

    expect(getWbot(10)).toBe(firstClient);

    const removal = removeWbot(10);

    expect(() => getWbot(10)).toThrow(AppError);

    await removal;
    expect(firstClient.destroy).toHaveBeenCalledTimes(1);

    const secondWhatsapp = buildWhatsapp();
    const secondInit = initWbot(secondWhatsapp);

    await mockClients[1].handlers.ready();
    const secondClient = await secondInit;

    expect(secondClient).not.toBe(firstClient);
    expect(getWbot(10)).toBe(secondClient);
  });
});
