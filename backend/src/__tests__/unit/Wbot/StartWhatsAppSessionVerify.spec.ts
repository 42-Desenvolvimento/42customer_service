import Whatsapp from "../../../models/Whatsapp";
import { getIO } from "../../../libs/socket";
import { initWbot, removeWbot } from "../../../libs/wbot";
import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { wbotMessageListener } from "../../../services/WbotServices/wbotMessageListener";
import wbotMonitor from "../../../services/WbotServices/wbotMonitor";

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: {
    findByPk: jest.fn()
  }
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

describe("StartWhatsAppSessionVerify", () => {
  const io = { emit: jest.fn() };
  const wbot = { id: 3 };
  const whatsapp = {
    id: 3,
    tenantId: 7,
    type: "whatsapp",
    update: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (getIO as jest.Mock).mockReturnValue(io);
    (initWbot as jest.Mock).mockResolvedValue(wbot);
    (Whatsapp.findByPk as jest.Mock).mockResolvedValue(whatsapp);
  });

  it("removes stale wbot before recovering a closed session", async () => {
    await StartWhatsAppSessionVerify(whatsapp.id, "Error: Session closed");

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(removeWbot).toHaveBeenCalledWith(whatsapp.id);
    expect((removeWbot as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (initWbot as jest.Mock).mock.invocationCallOrder[0]
    );
    expect(initWbot).toHaveBeenCalledWith(whatsapp);
    expect(wbotMessageListener).toHaveBeenCalledWith(wbot);
    expect(wbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);
  });

  it("recognizes sendSeen undefined errors regardless of casing", async () => {
    await StartWhatsAppSessionVerify(
      whatsapp.id,
      "TypeError: Cannot read property 'sendSeen' of undefined"
    );

    expect(removeWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(initWbot).toHaveBeenCalledWith(whatsapp);
  });
});

describe("StartWhatsAppSession", () => {
  const io = { emit: jest.fn() };
  const wbot = { id: 9 };
  const whatsapp = {
    id: 9,
    tenantId: 4,
    type: "whatsapp",
    update: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (getIO as jest.Mock).mockReturnValue(io);
    (initWbot as jest.Mock).mockResolvedValue(wbot);
  });

  it("removes stale wbot before starting a whatsapp session", async () => {
    await StartWhatsAppSession(whatsapp as any);

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(removeWbot).toHaveBeenCalledWith(whatsapp.id);
    expect((removeWbot as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (initWbot as jest.Mock).mock.invocationCallOrder[0]
    );
    expect(initWbot).toHaveBeenCalledWith(whatsapp);
    expect(wbotMessageListener).toHaveBeenCalledWith(wbot);
    expect(wbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);
  });
});
