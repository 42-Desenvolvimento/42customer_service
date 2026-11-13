const mockEmit = jest.fn();
const mockSyncUnreadMessagesWbot = jest.fn();
const mockLoggerError = jest.fn();
const mockClients: any[] = [];

jest.mock("whatsapp-web.js", () => ({
  Client: jest.fn().mockImplementation(() => {
    const { EventEmitter } = require("events");
    class ClientMock extends EventEmitter {
      id?: number;

      info = {
        wid: {
          user: "5511999999999"
        }
      };

      pupBrowser = {
        version: jest.fn().mockResolvedValue("Chrome/Test")
      };

      initialize = jest.fn().mockResolvedValue(undefined);

      destroy = jest.fn().mockResolvedValue(undefined);

      sendPresenceAvailable = jest.fn();

      getWWebVersion = jest.fn().mockResolvedValue("2.test");
    }

    const client = new ClientMock();
    mockClients.push(client);
    return client;
  }),
  LocalAuth: jest.fn(),
  DefaultOptions: {
    userAgent: "test-agent"
  }
}));

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../libs/socket", () => ({
  getIO: () => ({
    emit: (...args: unknown[]) => mockEmit(...args)
  })
}));

jest.mock("../../../services/WbotServices/SyncUnreadMessagesWbot", () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockSyncUnreadMessagesWbot(...args)
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
    info: jest.fn()
  }
}));

import { getWbot, initWbot, removeWbot } from "../../../libs/wbot";

const buildWhatsapp = () =>
  ({
    id: 1,
    name: "Principal",
    tenantId: 7,
    status: "OPENING",
    retries: 0,
    session: null,
    update: jest.fn().mockResolvedValue(undefined)
  } as any);

describe("wbot session registry", () => {
  afterEach(async () => {
    await removeWbot(1);
    mockClients.splice(0, mockClients.length);
    jest.clearAllMocks();
  });

  it("unregisters a stale client before waiting for destroy", async () => {
    const whatsapp = buildWhatsapp();
    const start = initWbot(whatsapp);
    const firstClient = mockClients[0];
    firstClient.emit("ready");
    await start;

    expect(getWbot(1)).toBe(firstClient);

    firstClient.destroy.mockRejectedValueOnce(
      new Error("browser already closed")
    );

    await removeWbot(1);

    expect(firstClient.destroy).toHaveBeenCalled();
    expect(() => getWbot(1)).toThrow();
    expect(mockLoggerError).toHaveBeenCalled();

    const restart = initWbot(whatsapp);
    const secondClient = mockClients[1];
    secondClient.emit("ready");
    await restart;

    expect(getWbot(1)).toBe(secondClient);
    expect(secondClient).not.toBe(firstClient);
  });
});
