const mockClients: any[] = [];
const mockEmit = jest.fn();
let mockInitializeError: Error | undefined;
const mockSyncUnreadMessagesWbot = jest.fn();

jest.mock("whatsapp-web.js", () => {
  const { EventEmitter } = require("events");

  return {
    Client: jest.fn().mockImplementation(() => {
      const client = new EventEmitter();
      Object.assign(client, {
        destroy: jest.fn().mockResolvedValue(undefined),
        getWWebVersion: jest.fn().mockResolvedValue("2.2409.2"),
        initialize: jest.fn().mockImplementation(() => {
          if (mockInitializeError) {
            return Promise.reject(mockInitializeError);
          }
          return Promise.resolve();
        }),
        info: { wid: { user: "5511999999999" } },
        pupBrowser: {
          version: jest.fn().mockResolvedValue("HeadlessChrome")
        },
        sendPresenceAvailable: jest.fn()
      });
      mockClients.push(client);
      return client;
    }),
    DefaultOptions: {
      userAgent: "jest-user-agent"
    },
    LocalAuth: jest.fn().mockImplementation(config => config)
  };
});

jest.mock("../../../libs/socket", () => ({
  getIO: () => ({ emit: mockEmit })
}));

jest.mock("../../../services/WbotServices/SyncUnreadMessagesWbot", () =>
  mockSyncUnreadMessagesWbot
);

import { getWbot, initWbot, removeWbot } from "../../../libs/wbot";

const buildWhatsapp = (id: number) => {
  const whatsapp: any = {
    id,
    name: `Session ${id}`,
    tenantId: 3,
    session: "",
    status: "OPENING",
    update: jest.fn().mockImplementation(async data => {
      Object.assign(whatsapp, data);
      return whatsapp;
    })
  };

  return whatsapp;
};

describe("wbot session registry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInitializeError = undefined;
    mockClients.splice(0, mockClients.length);
  });

  afterEach(async () => {
    await Promise.all([removeWbot(100), removeWbot(101)]);
  });

  it("removes a stale client before allowing a new client with the same id", async () => {
    const whatsapp = buildWhatsapp(100);

    const firstStart = initWbot(whatsapp);
    mockClients[0].emit("ready");
    const firstClient = await firstStart;

    expect(getWbot(whatsapp.id)).toBe(firstClient);

    await removeWbot(whatsapp.id);

    expect(firstClient.destroy).toHaveBeenCalledTimes(1);

    const secondStart = initWbot(whatsapp);
    mockClients[1].emit("ready");
    const secondClient = await secondStart;

    expect(secondClient).not.toBe(firstClient);
    expect(getWbot(whatsapp.id)).toBe(secondClient);
  });

  it("rejects startup when whatsapp-web.js initialize fails", async () => {
    const whatsapp = buildWhatsapp(101);

    mockInitializeError = new Error("Session closed");
    const failedStart = initWbot(whatsapp);

    await expect(failedStart).rejects.toThrow("Session closed");
  });
});
