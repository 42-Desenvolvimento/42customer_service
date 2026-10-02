import { Client } from "whatsapp-web.js";
import { getIO } from "../../../libs/socket";
import Whatsapp from "../../../models/Whatsapp";

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn()
}));

jest.mock("../../../services/WbotServices/SyncUnreadMessagesWbot", () =>
  jest.fn()
);

jest.mock("whatsapp-web.js", () => ({
  Client: jest.fn(),
  DefaultOptions: {
    userAgent: "jest"
  },
  LocalAuth: jest.fn()
}));

const ClientMock = Client as unknown as jest.Mock;
const getIOMock = getIO as jest.MockedFunction<typeof getIO>;

describe("wbot session cache", () => {
  const emit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    getIOMock.mockReturnValue({ emit } as never);
  });

  const makeWhatsapp = () =>
    ({
      id: 42,
      name: "main",
      tenantId: 7,
      status: "OPENING",
      retries: 0,
      update: jest.fn().mockResolvedValue(undefined)
    } as unknown as Whatsapp);

  it("removes a cached session before awaiting destroy", async () => {
    const whatsapp = makeWhatsapp();
    const callbacks: Record<string, () => Promise<void>> = {};
    const client = {
      id: whatsapp.id,
      info: {
        wid: {
          user: "5511999999999"
        }
      },
      pupBrowser: {
        version: jest.fn().mockResolvedValue("browser")
      },
      getWWebVersion: jest.fn().mockResolvedValue("2.2409.2"),
      sendPresenceAvailable: jest.fn(),
      initialize: jest.fn().mockResolvedValue(undefined),
      on: jest.fn((event: string, callback: () => Promise<void>) => {
        callbacks[event] = callback;
        return client;
      }),
      destroy: jest.fn().mockRejectedValue(new Error("destroy failed"))
    };
    ClientMock.mockImplementation(() => client);

    const { getWbot, initWbot, removeWbot } = await import(
      "../../../libs/wbot"
    );

    const initPromise = initWbot(whatsapp);
    await callbacks.ready();
    await expect(initPromise).resolves.toBe(client);

    await removeWbot(whatsapp.id);

    expect(client.destroy).toHaveBeenCalled();
    expect(() => getWbot(whatsapp.id)).toThrow("ERR_WAPP_NOT_INITIALIZED");
  });

  it("rejects when client initialization fails", async () => {
    const whatsapp = makeWhatsapp();
    const client = {
      id: whatsapp.id,
      initialize: jest.fn().mockRejectedValue(new Error("initialize failed")),
      on: jest.fn()
    };
    ClientMock.mockImplementation(() => client);

    const { initWbot } = await import("../../../libs/wbot");

    await expect(initWbot(whatsapp)).rejects.toThrow("initialize failed");
  });
});
