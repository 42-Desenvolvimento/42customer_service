import { initWbot, removeWbot } from "../../../libs/wbot";
import Whatsapp from "../../../models/Whatsapp";
import { getIO } from "../../../libs/socket";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";
import { wbotMessageListener } from "../../../services/WbotServices/wbotMessageListener";
import wbotMonitor from "../../../services/WbotServices/wbotMonitor";

jest.mock("../../../libs/wbot", () => ({
  initWbot: jest.fn(),
  removeWbot: jest.fn()
}));

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: {
    findByPk: jest.fn()
  }
}));

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn()
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

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

describe("WhatsApp session recovery", () => {
  const emit = jest.fn();
  const wbot = { id: 42 };

  beforeEach(() => {
    (getIO as jest.Mock).mockReturnValue({ emit });
    (initWbot as jest.Mock).mockResolvedValue(wbot);
  });

  it("removes the stale cached session before recovering from sendSeen failures", async () => {
    const whatsapp = {
      id: 42,
      tenantId: 7,
      update: jest.fn().mockResolvedValue(undefined)
    };

    (Whatsapp.findByPk as jest.Mock).mockResolvedValue(whatsapp);
    (initWbot as jest.Mock).mockImplementation(async () => {
      expect(removeWbot).toHaveBeenCalledWith(42);
      return wbot;
    });

    await StartWhatsAppSessionVerify(
      42,
      new Error("TypeError: Cannot read property 'sendSeen' of undefined")
    );

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(emit).toHaveBeenCalledWith("7:whatsappSession", {
      action: "update",
      session: whatsapp
    });
    expect(initWbot).toHaveBeenCalledWith(whatsapp);
    expect(wbotMessageListener).toHaveBeenCalledWith(wbot);
    expect(wbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);
  });

  it("does not recover on unrelated errors", async () => {
    await StartWhatsAppSessionVerify(42, new Error("invalid number"));

    expect(Whatsapp.findByPk).not.toHaveBeenCalled();
    expect(removeWbot).not.toHaveBeenCalled();
    expect(initWbot).not.toHaveBeenCalled();
  });

  it("removes the stale cached session before manually starting a WhatsApp session", async () => {
    const whatsapp = {
      id: 42,
      tenantId: 7,
      type: "whatsapp",
      update: jest.fn().mockResolvedValue(undefined)
    };

    (initWbot as jest.Mock).mockImplementation(async () => {
      expect(removeWbot).toHaveBeenCalledWith(42);
      return wbot;
    });

    await StartWhatsAppSession(whatsapp as any);

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(initWbot).toHaveBeenCalledWith(whatsapp);
    expect(wbotMessageListener).toHaveBeenCalledWith(wbot);
    expect(wbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);
  });
});
