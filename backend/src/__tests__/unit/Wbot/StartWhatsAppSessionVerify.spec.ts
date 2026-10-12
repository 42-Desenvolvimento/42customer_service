const mockInitWbot = jest.fn();
const mockRemoveWbot = jest.fn();
const mockFindByPk = jest.fn();
const mockEmit = jest.fn();
const mockWbotMessageListener = jest.fn();
const mockWbotMonitor = jest.fn();

jest.mock("../../../libs/wbot", () => ({
  initWbot: mockInitWbot,
  removeWbot: mockRemoveWbot
}));

jest.mock("../../../models/Whatsapp", () => ({
  findByPk: mockFindByPk
}));

jest.mock("../../../libs/socket", () => ({
  getIO: () => ({ emit: mockEmit })
}));

jest.mock("../../../services/WbotServices/wbotMessageListener", () => ({
  wbotMessageListener: mockWbotMessageListener
}));

jest.mock("../../../services/WbotServices/wbotMonitor", () => mockWbotMonitor);

import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

describe("StartWhatsAppSessionVerify", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRemoveWbot.mockResolvedValue(undefined);
  });

  it("removes a stale whatsapp client before starting a recovered session", async () => {
    const whatsapp = {
      id: 42,
      tenantId: 7,
      update: jest.fn().mockResolvedValue(undefined)
    };
    const wbot = { id: 42 };

    mockFindByPk.mockResolvedValue(whatsapp);
    mockInitWbot.mockResolvedValue(wbot);

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      new Error("Protocol error: Session closed")
    );

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(mockEmit).toHaveBeenCalledWith("7:whatsappSession", {
      action: "update",
      session: whatsapp
    });
    expect(mockRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(mockRemoveWbot.mock.invocationCallOrder[0]).toBeLessThan(
      mockInitWbot.mock.invocationCallOrder[0]
    );
    expect(mockWbotMessageListener).toHaveBeenCalledWith(wbot);
    expect(mockWbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);
  });

  it("accepts non-string errors from whatsapp-web.js recovery paths", async () => {
    const whatsapp = {
      id: 43,
      tenantId: 8,
      update: jest.fn().mockResolvedValue(undefined)
    };

    mockFindByPk.mockResolvedValue(whatsapp);
    mockInitWbot.mockResolvedValue({ id: 43 });

    await StartWhatsAppSessionVerify(whatsapp.id, {
      toString: () => "ERR_WAPP_NOT_INITIALIZED"
    });

    expect(mockRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockInitWbot).toHaveBeenCalledWith(whatsapp);
  });

  it("recovers when sendSeen fails because the underlying client is gone", async () => {
    const whatsapp = {
      id: 44,
      tenantId: 9,
      update: jest.fn().mockResolvedValue(undefined)
    };

    mockFindByPk.mockResolvedValue(whatsapp);
    mockInitWbot.mockResolvedValue({ id: 44 });

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      "TypeError: Cannot read property 'sendSeen' of undefined"
    );

    expect(mockRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockInitWbot).toHaveBeenCalledWith(whatsapp);
  });
});
