const mockClientInstances: any[] = [];
let mockInitializeImplementation: () => Promise<void> | void = () =>
  Promise.resolve();

const mockClientConstructor = jest.fn().mockImplementation(() => {
  const client = {
    id: 0,
    info: {
      wid: {
        user: "5511999999999"
      }
    },
    pupBrowser: {
      version: jest.fn().mockResolvedValue("Chrome/123")
    },
    getWWebVersion: jest.fn().mockResolvedValue("2.2409.2"),
    initialize: jest.fn(() => mockInitializeImplementation()),
    destroy: jest.fn().mockResolvedValue(undefined),
    on: jest.fn((event: string, callback: (...args: any[]) => void) => {
      client.handlers[event] = callback;
      return client;
    }),
    sendPresenceAvailable: jest.fn(),
    handlers: {} as Record<string, (...args: any[]) => void>
  };
  mockClientInstances.push(client);
  return client;
});

jest.mock("whatsapp-web.js", () => ({
  Client: mockClientConstructor,
  LocalAuth: jest.fn().mockImplementation(config => config),
  DefaultOptions: {
    userAgent: "test-user-agent"
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

import AppError from "../../../errors/AppError";
import { getWbot, initWbot, removeWbot } from "../../../libs/wbot";

const buildWhatsapp = (id: number) =>
  ({
    id,
    tenantId: 2,
    name: `session-${id}`,
    status: "OPENING",
    session: "",
    update: jest.fn().mockResolvedValue(undefined)
  } as any);

describe("wbot session registry", () => {
  beforeEach(async () => {
    mockClientInstances.length = 0;
    mockClientConstructor.mockClear();
    mockInitializeImplementation = () => Promise.resolve();
    await removeWbot(1);
    await removeWbot(2);
  });

  it("should remove a stale session from the registry before destroy finishes", async () => {
    const whatsapp = buildWhatsapp(1);
    const firstInit = initWbot(whatsapp);
    const firstClient = mockClientInstances[0];
    await firstClient.handlers.ready();
    await expect(firstInit).resolves.toBe(firstClient);

    expect(getWbot(1)).toBe(firstClient);

    let finishDestroy = () => {};
    firstClient.destroy.mockReturnValueOnce(
      new Promise<void>(resolve => {
        finishDestroy = resolve;
      })
    );

    const removePromise = removeWbot(1);

    expect(() => getWbot(1)).toThrow(AppError);
    finishDestroy();
    await removePromise;

    const secondInit = initWbot(whatsapp);
    const secondClient = mockClientInstances[1];
    await secondClient.handlers.ready();
    await expect(secondInit).resolves.toBe(secondClient);

    expect(getWbot(1)).toBe(secondClient);
    expect(getWbot(1)).not.toBe(firstClient);
  });

  it("should reject initialization errors instead of leaving callers pending", async () => {
    const error = new Error("browser failed to start");
    mockInitializeImplementation = () => {
      throw error;
    };

    await expect(initWbot(buildWhatsapp(2))).rejects.toThrow(error);
  });
});
