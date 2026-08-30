import { initWbot, removeWbot } from "../../../libs/wbot";
import { getIO } from "../../../libs/socket";
import Whatsapp from "../../../models/Whatsapp";
import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import wbotMonitor from "../../../services/WbotServices/wbotMonitor";
import { wbotMessageListener } from "../../../services/WbotServices/wbotMessageListener";

jest.mock("../../../libs/wbot", () => ({
  initWbot: jest.fn(),
  removeWbot: jest.fn()
}));

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn()
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
  const emit = jest.fn();
  const wbot = { id: 42 };
  let whatsapp: any;
  let callOrder: string[];

  beforeEach(() => {
    callOrder = [];

    jest.clearAllMocks();

    whatsapp = {
      id: 42,
      tenantId: 7,
      type: "whatsapp",
      update: jest.fn().mockResolvedValue(undefined)
    };

    (getIO as jest.Mock).mockReturnValue({ emit });
    (removeWbot as jest.Mock).mockImplementation(() => {
      callOrder.push("remove");
    });
    (initWbot as jest.Mock).mockImplementation(async () => {
      callOrder.push("init");
      return wbot;
    });
    (Whatsapp.findByPk as jest.Mock).mockResolvedValue(whatsapp);
  });

  it("removes the stale cached session before recovery creates a new client", async () => {
    await StartWhatsAppSessionVerify(
      42,
      new TypeError("Cannot read properties of undefined (reading 'sendSeen')")
    );

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(removeWbot).toHaveBeenCalledWith(42);
    expect(initWbot).toHaveBeenCalledWith(whatsapp);
    expect(callOrder).toEqual(["remove", "init"]);
    expect(wbotMessageListener).toHaveBeenCalledWith(wbot);
    expect(wbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);
  });

  it("removes an existing WhatsApp client before manually starting a session", async () => {
    await StartWhatsAppSession(whatsapp);

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(removeWbot).toHaveBeenCalledWith(42);
    expect(initWbot).toHaveBeenCalledWith(whatsapp);
    expect(callOrder).toEqual(["remove", "init"]);
  });

  it("does not restart a session for unrelated send errors", async () => {
    await StartWhatsAppSessionVerify(42, new Error("media upload failed"));

    expect(Whatsapp.findByPk).not.toHaveBeenCalled();
    expect(removeWbot).not.toHaveBeenCalled();
    expect(initWbot).not.toHaveBeenCalled();
  });
});
