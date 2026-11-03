const mockClientInstances: any[] = [];
let mockInitializeImplementation = (): Promise<void> => Promise.resolve();
const mockEmit = jest.fn();

jest.mock("whatsapp-web.js", () => {
  const { EventEmitter } = jest.requireActual("events");

  return {
    Client: jest.fn().mockImplementation(() => {
      const client = new EventEmitter() as any;
      client.initialize = jest.fn(() => mockInitializeImplementation());
      client.destroy = jest.fn();
      client.info = { wid: { user: "5511999999999" } };
      client.getWWebVersion = jest.fn().mockResolvedValue("2.0.0");
      client.pupBrowser = {
        version: jest.fn().mockResolvedValue("Chrome/100")
      };
      client.sendPresenceAvailable = jest.fn();
      mockClientInstances.push(client);
      return client;
    }),
    LocalAuth: jest.fn(),
    DefaultOptions: {
      userAgent: "test-agent"
    }
  };
});

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn(() => ({ emit: mockEmit }))
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

describe("wbot session registry", () => {
  const buildWhatsapp = (id: number) =>
    ({
      id,
      name: `session-${id}`,
      tenantId: 5,
      session: null,
      status: "OPENING",
      retries: 0,
      update: jest.fn().mockResolvedValue(undefined)
    } as any);

  beforeEach(() => {
    mockClientInstances.splice(0, mockClientInstances.length);
    mockInitializeImplementation = () => Promise.resolve();
    mockEmit.mockClear();
  });

  afterEach(async () => {
    await removeWbot(101);
    await removeWbot(102);
  });

  it("removes a session from the registry even when destroy throws synchronously", async () => {
    const whatsapp = buildWhatsapp(101);
    const starting = initWbot(whatsapp);
    const client = mockClientInstances[0];

    client.emit("ready");
    await starting;
    expect(getWbot(whatsapp.id)).toBe(client);

    client.destroy = jest.fn(() => {
      throw new Error("destroy failed");
    });

    await removeWbot(whatsapp.id);

    expect(() => getWbot(whatsapp.id)).toThrow("ERR_WAPP_NOT_INITIALIZED");
  });

  it("rejects initWbot when the client initialize call fails", async () => {
    mockInitializeImplementation = () =>
      Promise.reject(new Error("initialize failed"));

    await expect(initWbot(buildWhatsapp(102))).rejects.toThrow(
      "initialize failed"
    );
  });
});
