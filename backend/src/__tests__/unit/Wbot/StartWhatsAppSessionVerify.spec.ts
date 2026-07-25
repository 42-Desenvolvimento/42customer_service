import Whatsapp from "../../../models/Whatsapp";
import { getIO } from "../../../libs/socket";
import { initWbot, removeWbot } from "../../../libs/wbot";
import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

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

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

describe("WhatsApp session restart", () => {
  const emit = jest.fn();
  const whatsapp = {
    id: 42,
    tenantId: 7,
    type: "whatsapp",
    update: jest.fn()
  };

  beforeEach(() => {
    emit.mockClear();
    whatsapp.update.mockResolvedValue(undefined);
    (getIO as jest.Mock).mockReturnValue({ emit });
    (initWbot as jest.Mock).mockResolvedValue({ id: whatsapp.id });
    (Whatsapp.findByPk as jest.Mock).mockResolvedValue(whatsapp);
  });

  it("removes the stale client before restarting a closed session", async () => {
    await StartWhatsAppSessionVerify(whatsapp.id, "Error: Session closed");

    expect(removeWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(initWbot).toHaveBeenCalledWith(whatsapp);
    expect((removeWbot as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (initWbot as jest.Mock).mock.invocationCallOrder[0]
    );
  });

  it("recognizes sendSeen disconnect errors case-insensitively", async () => {
    await StartWhatsAppSessionVerify(
      whatsapp.id,
      "TypeError: Cannot read property 'sendSeen' of undefined"
    );

    expect(removeWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(initWbot).toHaveBeenCalledWith(whatsapp);
  });

  it("removes the stale client before starting a WhatsApp session directly", async () => {
    await StartWhatsAppSession(whatsapp as any);

    expect(removeWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(initWbot).toHaveBeenCalledWith(whatsapp);
    expect((removeWbot as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (initWbot as jest.Mock).mock.invocationCallOrder[0]
    );
  });
});
