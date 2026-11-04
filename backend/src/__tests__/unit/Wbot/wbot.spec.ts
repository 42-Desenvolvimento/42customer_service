import { EventEmitter } from "events";
import AppError from "../../../errors/AppError";
import { getWbot, initWbot, removeWbot } from "../../../libs/wbot";

let mockClients: MockClient[] = [];
let mockDestroyPromise: Promise<void>;
let mockResolveDestroy: () => void;

class MockClient extends EventEmitter {
  id!: number;

  info = {
    wid: {
      user: "5511999999999"
    }
  };

  pupBrowser = {
    version: jest.fn().mockResolvedValue("Chrome/120")
  };

  initialize = jest.fn().mockResolvedValue(undefined);

  destroy = jest.fn(() => mockDestroyPromise);

  getWWebVersion = jest.fn().mockResolvedValue("2.2409.2");

  sendPresenceAvailable = jest.fn();
}

jest.mock("whatsapp-web.js", () => ({
  Client: jest.fn().mockImplementation(() => {
    const client = new MockClient();
    mockClients.push(client);
    return client;
  }),
  LocalAuth: jest.fn().mockImplementation(config => config),
  DefaultOptions: {
    userAgent: "mock-user-agent"
  }
}));

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn(() => ({
    emit: jest.fn()
  }))
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

describe("wbot registry", () => {
  beforeEach(() => {
    mockClients = [];
    mockDestroyPromise = new Promise(resolve => {
      mockResolveDestroy = resolve;
    });
  });

  it("removes a session from the registry before waiting for destroy", async () => {
    const whatsapp = {
      id: 42,
      name: "Main",
      tenantId: 7,
      session: null,
      status: "OPENING",
      update: jest.fn().mockResolvedValue(undefined)
    };

    const readySession = initWbot(whatsapp as any);
    const client = mockClients[0];

    client.emit("ready");
    await readySession;

    expect(getWbot(42)).toBe(client);

    const removal = removeWbot(42);

    expect(() => getWbot(42)).toThrow(AppError);

    mockResolveDestroy();
    await removal;
    expect(client.destroy).toHaveBeenCalledTimes(1);
  });
});
