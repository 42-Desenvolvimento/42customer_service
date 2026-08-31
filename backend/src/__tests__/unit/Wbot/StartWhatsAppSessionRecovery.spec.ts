import Whatsapp from "../../../models/Whatsapp";
import { getIO } from "../../../libs/socket";
import { initWbot, removeWbot } from "../../../libs/wbot";
import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { wbotMessageListener } from "../../../services/WbotServices/wbotMessageListener";
import wbotMonitor from "../../../services/WbotServices/wbotMonitor";

jest.mock("../../../models/Whatsapp", () => ({
  findByPk: jest.fn()
}));

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn()
}));

jest.mock("../../../libs/wbot", () => ({
  initWbot: jest.fn(),
  removeWbot: jest.fn()
}));

jest.mock("../../../services/WbotServices/wbotMessageListener", () => ({
  wbotMessageListener: jest.fn()
}));

jest.mock("../../../services/WbotServices/wbotMonitor", () => jest.fn());

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
  beforeEach(() => {
    jest.clearAllMocks();
    (getIO as jest.Mock).mockReturnValue({ emit: jest.fn() });
    (initWbot as jest.Mock).mockResolvedValue({ id: 1 });
  });

  it("removes the cached client before reinitializing a closed session", async () => {
    const callOrder: string[] = [];
    const whatsapp = {
      id: 7,
      tenantId: 3,
      update: jest.fn().mockResolvedValue(undefined)
    };

    (Whatsapp.findByPk as jest.Mock).mockResolvedValue(whatsapp);
    (removeWbot as jest.Mock).mockImplementation(() => {
      callOrder.push("removeWbot");
    });
    (initWbot as jest.Mock).mockImplementation(async () => {
      callOrder.push("initWbot");
      return { id: whatsapp.id };
    });

    await StartWhatsAppSessionVerify(whatsapp.id, new Error("Session closed"));

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(removeWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(initWbot).toHaveBeenCalledWith(whatsapp);
    expect(callOrder).toEqual(["removeWbot", "initWbot"]);
    expect(wbotMessageListener).toHaveBeenCalledWith({ id: whatsapp.id });
    expect(wbotMonitor).toHaveBeenCalledWith({ id: whatsapp.id }, whatsapp);
  });

  it("recovers when sendSeen fails because the underlying client is gone", async () => {
    const whatsapp = {
      id: 11,
      tenantId: 4,
      update: jest.fn().mockResolvedValue(undefined)
    };

    (Whatsapp.findByPk as jest.Mock).mockResolvedValue(whatsapp);

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      "TypeError: Cannot read property 'sendSeen' of undefined"
    );

    expect(removeWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(initWbot).toHaveBeenCalledWith(whatsapp);
  });

  it("removes any previous cached client before starting a whatsapp session", async () => {
    const callOrder: string[] = [];
    const whatsapp = {
      id: 13,
      tenantId: 5,
      type: "whatsapp",
      update: jest.fn().mockResolvedValue(undefined)
    };

    (removeWbot as jest.Mock).mockImplementation(() => {
      callOrder.push("removeWbot");
    });
    (initWbot as jest.Mock).mockImplementation(async () => {
      callOrder.push("initWbot");
      return { id: whatsapp.id };
    });

    await StartWhatsAppSession(whatsapp as unknown as Whatsapp);

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(removeWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(initWbot).toHaveBeenCalledWith(whatsapp);
    expect(callOrder).toEqual(["removeWbot", "initWbot"]);
  });
});
