import Whatsapp from "../../../models/Whatsapp";
import { initWbot, removeWbot } from "../../../libs/wbot";
import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

const mockEmit = jest.fn();

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: {
    findByPk: jest.fn()
  }
}));

jest.mock("../../../libs/wbot", () => ({
  initWbot: jest.fn(),
  removeWbot: jest.fn()
}));

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn(() => ({
    emit: mockEmit
  }))
}));

jest.mock("../../../services/WbotServices/wbotMessageListener", () => ({
  wbotMessageListener: jest.fn()
}));

jest.mock("../../../services/WbotServices/wbotMonitor", () => ({
  __esModule: true,
  default: jest.fn()
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

describe("WhatsApp session recovery", () => {
  const mockWbot = { id: 12 };
  const mockWhatsapp = {
    id: 12,
    tenantId: 34,
    type: "whatsapp",
    update: jest.fn().mockResolvedValue(undefined)
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (Whatsapp.findByPk as jest.Mock).mockResolvedValue(mockWhatsapp);
    (initWbot as jest.Mock).mockResolvedValue(mockWbot);
    (removeWbot as jest.Mock).mockResolvedValue(undefined);
  });

  it.each([
    new TypeError("Cannot read property 'sendSeen' of undefined"),
    new TypeError("Cannot read properties of undefined (reading 'sendSeen')")
  ])(
    "replaces the cached client before recovering from sendSeen errors",
    async error => {
      const calls: string[] = [];
      (removeWbot as jest.Mock).mockImplementation(async () => {
        calls.push("remove");
      });
      (initWbot as jest.Mock).mockImplementation(async () => {
        calls.push("init");
        return mockWbot;
      });

      await StartWhatsAppSessionVerify(mockWhatsapp.id, error);

      expect(removeWbot).toHaveBeenCalledWith(mockWhatsapp.id);
      expect(initWbot).toHaveBeenCalledWith(mockWhatsapp);
      expect(calls).toEqual(["remove", "init"]);
    }
  );

  it("replaces the cached client before starting a whatsapp session", async () => {
    const calls: string[] = [];
    (removeWbot as jest.Mock).mockImplementation(async () => {
      calls.push("remove");
    });
    (initWbot as jest.Mock).mockImplementation(async () => {
      calls.push("init");
      return mockWbot;
    });

    await StartWhatsAppSession(mockWhatsapp as any);

    expect(mockWhatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(removeWbot).toHaveBeenCalledWith(mockWhatsapp.id);
    expect(initWbot).toHaveBeenCalledWith(mockWhatsapp);
    expect(calls).toEqual(["remove", "init"]);
  });
});
