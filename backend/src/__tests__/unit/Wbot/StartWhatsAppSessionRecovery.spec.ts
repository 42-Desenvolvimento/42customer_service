const mockInitWbot = jest.fn();
const mockRemoveWbot = jest.fn();
const mockEmit = jest.fn();
const mockWbotMessageListener = jest.fn();
const mockWbotMonitor = jest.fn();

jest.mock("../../../libs/wbot", () => ({
  initWbot: mockInitWbot,
  removeWbot: mockRemoveWbot
}));

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn(() => ({ emit: mockEmit }))
}));

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: {
    findByPk: jest.fn()
  }
}));

jest.mock("../../../services/WbotServices/wbotMessageListener", () => ({
  wbotMessageListener: mockWbotMessageListener
}));

jest.mock("../../../services/WbotServices/wbotMonitor", () => ({
  __esModule: true,
  default: mockWbotMonitor
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn()
  }
}));

import Whatsapp from "../../../models/Whatsapp";
import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

describe("WhatsApp session recovery", () => {
  const findByPk = Whatsapp.findByPk as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockInitWbot.mockResolvedValue({ id: 42 });
  });

  it("replaces the cached client before recovering from a sendSeen disconnect", async () => {
    const whatsapp = {
      id: 42,
      tenantId: 7,
      update: jest.fn().mockResolvedValue(undefined)
    };

    findByPk.mockResolvedValue(whatsapp);

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      new TypeError("Cannot read property 'sendSeen' of undefined")
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
    expect(mockWbotMessageListener).toHaveBeenCalledWith({ id: 42 });
    expect(mockWbotMonitor).toHaveBeenCalledWith({ id: 42 }, whatsapp);
  });

  it("does not restart a session for unrelated send errors", async () => {
    await StartWhatsAppSessionVerify(42, new Error("media upload failed"));

    expect(findByPk).not.toHaveBeenCalled();
    expect(mockRemoveWbot).not.toHaveBeenCalled();
    expect(mockInitWbot).not.toHaveBeenCalled();
  });

  it("replaces the cached client before starting a whatsapp session", async () => {
    const whatsapp = {
      id: 99,
      tenantId: 3,
      type: "whatsapp",
      update: jest.fn().mockResolvedValue(undefined)
    };

    await StartWhatsAppSession(whatsapp as any);

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(mockRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(mockRemoveWbot.mock.invocationCallOrder[0]).toBeLessThan(
      mockInitWbot.mock.invocationCallOrder[0]
    );
  });
});
