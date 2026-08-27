import { Client } from "whatsapp-web.js";
import { getWbot, initWbot, removeWbot } from "../../../libs/wbot";

jest.mock("whatsapp-web.js", () => ({
  Client: jest.fn(),
  LocalAuth: jest.fn(),
  DefaultOptions: {
    userAgent: "test-agent"
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

describe("Wbot session registry", () => {
  it("removes a session from the registry even when destroy fails", async () => {
    const handlers: Record<string, () => Promise<void>> = {};
    const destroy = jest.fn();
    const client: any = {
      destroy,
      getWWebVersion: jest.fn().mockResolvedValue("2.0.0"),
      initialize: jest.fn(),
      on: jest.fn((event: string, handler: () => Promise<void>) => {
        handlers[event] = handler;
        return client;
      }),
      pupBrowser: {
        version: jest.fn().mockResolvedValue("Chrome/test")
      },
      sendPresenceAvailable: jest.fn()
    };
    const whatsapp = {
      id: 789,
      name: "Test WhatsApp",
      tenantId: 456,
      status: "CONNECTED",
      update: jest.fn().mockResolvedValue(undefined)
    };

    (Client as unknown as jest.Mock).mockImplementation(() => client);

    const initPromise = initWbot(whatsapp as any);
    await handlers.ready();
    await initPromise;

    expect(getWbot(whatsapp.id)).toBe(client);

    destroy.mockImplementation(() => {
      throw new Error("destroy failed");
    });

    removeWbot(whatsapp.id);

    expect(() => getWbot(whatsapp.id)).toThrow("ERR_WAPP_NOT_INITIALIZED");
  });
});
