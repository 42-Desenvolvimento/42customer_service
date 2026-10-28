type MockClient = {
  id?: number;
  info: { wid: { user: string } };
  pupBrowser: { version: jest.Mock };
  handlers: Record<string, (...args: any[]) => Promise<void> | void>;
  initialize: jest.Mock;
  on: jest.Mock;
  getWWebVersion: jest.Mock;
  sendPresenceAvailable: jest.Mock;
  destroy: jest.Mock;
};

let mockClients: MockClient[] = [];
let mockInitializeImplementation = (): Promise<void> => Promise.resolve();
const mockEmit = jest.fn();

const mockCreateClient = (): MockClient => {
  const client: MockClient = {
    info: { wid: { user: "5511999999999" } },
    pupBrowser: { version: jest.fn().mockResolvedValue("Chrome/mock") },
    handlers: {},
    initialize: jest.fn(() => mockInitializeImplementation()),
    on: jest.fn((event: string, callback: (...args: any[]) => void) => {
      client.handlers[event] = callback;
      return client;
    }),
    getWWebVersion: jest.fn().mockResolvedValue("2.0000.0"),
    sendPresenceAvailable: jest.fn(),
    destroy: jest.fn().mockResolvedValue(undefined)
  };

  mockClients.push(client);
  return client;
};

jest.mock("whatsapp-web.js", () => ({
  Client: jest.fn().mockImplementation(() => mockCreateClient()),
  LocalAuth: jest.fn().mockImplementation(() => ({})),
  DefaultOptions: {
    userAgent: "mock-user-agent"
  }
}));

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn(() => ({ emit: mockEmit }))
}));

jest.mock("../../../services/WbotServices/SyncUnreadMessagesWbot", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

const loadWbot = (): typeof import("../../../libs/wbot") =>
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  require("../../../libs/wbot");

const createWhatsapp = (id = 42): any => {
  const whatsapp = {
    id,
    name: "Main WhatsApp",
    tenantId: 7,
    status: "DISCONNECTED",
    session: null,
    retries: 0,
    update: jest.fn().mockImplementation(async values => {
      Object.assign(whatsapp, values);
      return whatsapp;
    })
  };

  return whatsapp;
};

describe("wbot session registry", () => {
  beforeEach(() => {
    jest.resetModules();
    mockClients = [];
    mockInitializeImplementation = () => Promise.resolve();
    mockEmit.mockClear();
  });

  it("allows a session to be replaced even when the old client destroy fails", async () => {
    const { initWbot, getWbot, removeWbot } = loadWbot();
    const whatsapp = createWhatsapp();

    const firstSessionPromise = initWbot(whatsapp);
    await mockClients[0].handlers.ready();
    const firstSession = await firstSessionPromise;

    expect(getWbot(42)).toBe(firstSession);

    mockClients[0].destroy.mockImplementation(() => {
      throw new Error("destroy failed");
    });

    await removeWbot(42);

    const secondSessionPromise = initWbot(whatsapp);
    await mockClients[1].handlers.ready();
    const secondSession = await secondSessionPromise;

    expect(secondSession).not.toBe(firstSession);
    expect(getWbot(42)).toBe(secondSession);
  });

  it("rejects startup when the underlying client initialization fails", async () => {
    mockInitializeImplementation = () => Promise.reject(new Error("boom"));
    const { initWbot } = loadWbot();

    await expect(initWbot(createWhatsapp())).rejects.toThrow(
      "Error starting whatsapp session."
    );
  });
});
