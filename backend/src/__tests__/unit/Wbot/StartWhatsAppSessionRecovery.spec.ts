const mockWbot = { id: 7 };
const mockCallOrder: string[] = [];
const mockFindByPk = jest.fn();
const mockEmit = jest.fn();
const mockGetIO = jest.fn(() => ({ emit: mockEmit }));
const mockWbotMessageListener = jest.fn();
const mockWbotMonitor = jest.fn();

const mockWhatsapp = {
  id: 7,
  tenantId: 42,
  type: "whatsapp",
  update: jest.fn()
};

jest.mock("../../../libs/wbot", () => ({
  initWbot: jest.fn(async () => {
    mockCallOrder.push("init");
    return mockWbot;
  }),
  removeWbot: jest.fn(() => {
    mockCallOrder.push("remove");
  })
}));

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: {
    findByPk: mockFindByPk
  }
}));

jest.mock("../../../libs/socket", () => ({
  getIO: mockGetIO
}));

jest.mock("../../../services/WbotServices/wbotMessageListener", () => ({
  wbotMessageListener: mockWbotMessageListener
}));

jest.mock("../../../services/WbotServices/wbotMonitor", () => ({
  __esModule: true,
  default: mockWbotMonitor
}));

jest.mock("../../../services/InstagramBotServices/StartInstaBotSession", () => ({
  StartInstaBotSession: jest.fn()
}));

jest.mock("../../../services/TbotServices/StartTbotSession", () => ({
  StartTbotSession: jest.fn()
}));

jest.mock("../../../services/WABA360/StartWaba360", () => ({
  StartWaba360: jest.fn()
}));

jest.mock("../../../services/MessengerChannelServices/StartMessengerBot", () => ({
  StartMessengerBot: jest.fn()
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn()
  }
}));

import { initWbot, removeWbot } from "../../../libs/wbot";
import Whatsapp from "../../../models/Whatsapp";
import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

describe("WhatsApp session recovery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCallOrder.length = 0;
    mockWhatsapp.update.mockResolvedValue(mockWhatsapp);
    mockFindByPk.mockResolvedValue(mockWhatsapp);
  });

  it.each([
    new Error("TypeError: Cannot read property 'sendSeen' of undefined"),
    new TypeError("Cannot read properties of undefined (reading 'sendSeen')")
  ])(
    "removes the stale client before recovering from sendSeen failures",
    async error => {
      await StartWhatsAppSessionVerify(mockWhatsapp.id, error);

      expect(Whatsapp.findByPk).toHaveBeenCalledWith(mockWhatsapp.id);
      expect(mockWhatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
      expect(mockEmit).toHaveBeenCalledWith(
        `${mockWhatsapp.tenantId}:whatsappSession`,
        {
          action: "update",
          session: mockWhatsapp
        }
      );
      expect(removeWbot).toHaveBeenCalledWith(mockWhatsapp.id);
      expect(initWbot).toHaveBeenCalledWith(mockWhatsapp);
      expect(mockCallOrder).toEqual(["remove", "init"]);
      expect(mockWbotMessageListener).toHaveBeenCalledWith(mockWbot);
      expect(mockWbotMonitor).toHaveBeenCalledWith(mockWbot, mockWhatsapp);
    }
  );

  it("does not restart the session for unrelated errors", async () => {
    await StartWhatsAppSessionVerify(mockWhatsapp.id, new Error("network busy"));

    expect(Whatsapp.findByPk).not.toHaveBeenCalled();
    expect(removeWbot).not.toHaveBeenCalled();
    expect(initWbot).not.toHaveBeenCalled();
  });

  it("removes any existing client before manually starting a WhatsApp session", async () => {
    await StartWhatsAppSession(mockWhatsapp as any);

    expect(mockWhatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(removeWbot).toHaveBeenCalledWith(mockWhatsapp.id);
    expect(initWbot).toHaveBeenCalledWith(mockWhatsapp);
    expect(mockCallOrder).toEqual(["remove", "init"]);
    expect(mockWbotMessageListener).toHaveBeenCalledWith(mockWbot);
    expect(mockWbotMonitor).toHaveBeenCalledWith(mockWbot, mockWhatsapp);
  });
});
