const mockClientInstances: any[] = [];
const mockEmit = jest.fn();
const mockLoggerError = jest.fn();

jest.mock("whatsapp-web.js", () => {
  const { EventEmitter } = require("events");

  class MockClient extends EventEmitter {
    public id!: number;

    public info = { wid: { user: "5511999999999" } };

    public pupBrowser = {
      version: jest.fn().mockResolvedValue("Chrome/123")
    };

    public initialize = jest.fn().mockResolvedValue(undefined);

    public destroy = jest.fn().mockResolvedValue(undefined);

    public getWWebVersion = jest.fn().mockResolvedValue("2.2409.2");

    public sendPresenceAvailable = jest.fn();

    constructor() {
      super();
      mockClientInstances.push(this);
    }
  }

  return {
    Client: MockClient,
    LocalAuth: jest.fn(),
    DefaultOptions: { userAgent: "mock-user-agent" }
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
    info: jest.fn(),
    error: mockLoggerError
  }
}));

import { getWbot, initWbot, removeWbot } from "../../../libs/wbot";

const makeWhatsapp = (id = 123): any => {
  const whatsapp: any = {
    id,
    name: `session-${id}`,
    tenantId: 7,
    status: "DISCONNECTED",
    session: null,
    retries: 0,
    update: jest.fn(async data => {
      Object.assign(whatsapp, data);
    })
  };

  return whatsapp;
};

describe("wbot session registry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClientInstances.splice(0, mockClientInstances.length);
  });

  it("removes a session from the registry before awaiting destroy", async () => {
    const whatsapp = makeWhatsapp();
    const initPromise = initWbot(whatsapp);
    const [client] = mockClientInstances;

    client.emit("ready");
    await initPromise;

    expect(getWbot(whatsapp.id)).toBe(client);

    let destroyCouldStillReadSession = false;
    client.destroy.mockImplementationOnce(() => {
      try {
        getWbot(whatsapp.id);
        destroyCouldStillReadSession = true;
      } catch (err) {
        destroyCouldStillReadSession = false;
      }

      return Promise.resolve();
    });

    await removeWbot(whatsapp.id);

    expect(client.destroy).toHaveBeenCalledTimes(1);
    expect(destroyCouldStillReadSession).toBe(false);
    expect(() => getWbot(whatsapp.id)).toThrow();
  });
});
