const makeWhatsapp = () => {
  const whatsapp: any = {
    id: 1,
    name: "whatsapp-test",
    tenantId: 1,
    session: "",
    status: "OPENING",
    retries: 0
  };

  whatsapp.update = jest.fn(async data => {
    Object.assign(whatsapp, data);
    return whatsapp;
  });

  return whatsapp;
};

describe("wbot session cache", () => {
  let clients: any[];
  let initializeImpl: () => Promise<void>;

  beforeEach(() => {
    jest.resetModules();
    clients = [];
    initializeImpl = () => Promise.resolve();

    jest.doMock("whatsapp-web.js", () => ({
      Client: jest.fn().mockImplementation(() => {
        const client: any = {
          handlers: {},
          initialize: jest.fn(() => initializeImpl()),
          on: jest.fn((event, handler) => {
            client.handlers[event] = handler;
            return client;
          }),
          destroy: jest.fn(() => Promise.resolve()),
          getWWebVersion: jest.fn(async () => "test-version"),
          pupBrowser: {
            version: jest.fn(async () => "test-browser")
          },
          sendPresenceAvailable: jest.fn(),
          info: {
            wid: {
              user: "5511999999999"
            }
          }
        };

        clients.push(client);
        return client;
      }),
      LocalAuth: jest.fn(),
      DefaultOptions: {
        userAgent: "test-user-agent"
      }
    }));

    jest.doMock("../../../libs/socket", () => ({
      getIO: jest.fn(() => ({
        emit: jest.fn()
      }))
    }));

    jest.doMock("../../../services/WbotServices/SyncUnreadMessagesWbot", () =>
      jest.fn()
    );
  });

  it("removes a cached session even when destroy throws synchronously", async () => {
    const { getWbot, initWbot, removeWbot } = require("../../../libs/wbot");
    const whatsapp = makeWhatsapp();

    const firstStart = initWbot(whatsapp);
    await clients[0].handlers.ready();
    await expect(firstStart).resolves.toBe(clients[0]);
    expect(getWbot(1)).toBe(clients[0]);

    clients[0].destroy.mockImplementation(() => {
      throw new Error("destroy failed");
    });

    await removeWbot(1);
    expect(() => getWbot(1)).toThrow("ERR_WAPP_NOT_INITIALIZED");

    const secondStart = initWbot(whatsapp);
    await clients[1].handlers.ready();
    await expect(secondStart).resolves.toBe(clients[1]);
    expect(getWbot(1)).toBe(clients[1]);
  });

  it("rejects initialization failures instead of leaving callers waiting", async () => {
    initializeImpl = () => Promise.reject(new Error("launch failed"));

    const { initWbot } = require("../../../libs/wbot");

    await expect(initWbot(makeWhatsapp())).rejects.toThrow("launch failed");
  });
});
