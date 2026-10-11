import { getIO } from "../../../libs/socket";
import { initWbot, removeWbot } from "../../../libs/wbot";
import Whatsapp from "../../../models/Whatsapp";
import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { wbotMessageListener } from "../../../services/WbotServices/wbotMessageListener";
import wbotMonitor from "../../../services/WbotServices/wbotMonitor";

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn()
}));

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
  const wbot = { on: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    (getIO as jest.Mock).mockReturnValue({ emit });
    (removeWbot as jest.Mock).mockResolvedValue(undefined);
    (initWbot as jest.Mock).mockResolvedValue(wbot);
  });

  it("removes the stale session before recovering after a sendSeen failure", async () => {
    const order: string[] = [];
    const whatsapp = {
      id: 7,
      tenantId: 3,
      update: jest.fn().mockResolvedValue(undefined)
    };

    (Whatsapp.findByPk as jest.Mock).mockResolvedValue(whatsapp);
    (removeWbot as jest.Mock).mockImplementation(async () => {
      order.push("remove");
    });
    (initWbot as jest.Mock).mockImplementation(async () => {
      order.push("init");
      return wbot;
    });

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      new TypeError("Cannot read property 'sendSeen' of undefined")
    );

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(removeWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(initWbot).toHaveBeenCalledWith(whatsapp);
    expect(order).toEqual(["remove", "init"]);
    expect(wbotMessageListener).toHaveBeenCalledWith(wbot);
    expect(wbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);
  });

  it("does not restart sessions for unrelated send errors", async () => {
    await StartWhatsAppSessionVerify(7, new Error("rate limited"));

    expect(Whatsapp.findByPk).not.toHaveBeenCalled();
    expect(removeWbot).not.toHaveBeenCalled();
    expect(initWbot).not.toHaveBeenCalled();
  });

  it("removes the current WhatsApp session before starting a new one", async () => {
    const order: string[] = [];
    const whatsapp = {
      id: 9,
      tenantId: 4,
      type: "whatsapp",
      update: jest.fn().mockResolvedValue(undefined)
    };

    (removeWbot as jest.Mock).mockImplementation(async () => {
      order.push("remove");
    });
    (initWbot as jest.Mock).mockImplementation(async () => {
      order.push("init");
      return wbot;
    });

    await StartWhatsAppSession(whatsapp as any);

    expect(removeWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(initWbot).toHaveBeenCalledWith(whatsapp);
    expect(order).toEqual(["remove", "init"]);
    expect(wbotMessageListener).toHaveBeenCalledWith(wbot);
    expect(wbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);
  });
});
