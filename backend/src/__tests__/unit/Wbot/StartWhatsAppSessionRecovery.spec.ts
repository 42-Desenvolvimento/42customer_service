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

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

describe("WhatsApp session recovery", () => {
  const emit = jest.fn();
  const whatsapp = {
    id: 7,
    tenantId: 3,
    type: "whatsapp",
    update: jest.fn()
  };
  const wbot = { id: whatsapp.id };

  beforeEach(() => {
    jest.clearAllMocks();
    whatsapp.update.mockResolvedValue(whatsapp);
    (getIO as jest.Mock).mockReturnValue({ emit });
    (Whatsapp.findByPk as jest.Mock).mockResolvedValue(whatsapp);
    (initWbot as jest.Mock).mockResolvedValue(wbot);
  });

  it("removes stale sessions before recovering from sendSeen failures", async () => {
    const calls: string[] = [];
    (removeWbot as jest.Mock).mockImplementation(() => calls.push("remove"));
    (initWbot as jest.Mock).mockImplementation(async () => {
      calls.push("init");
      return wbot;
    });

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      new TypeError("Cannot read property 'sendSeen' of undefined")
    );

    expect(Whatsapp.findByPk).toHaveBeenCalledWith(whatsapp.id);
    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(removeWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(initWbot).toHaveBeenCalledWith(whatsapp);
    expect(calls).toEqual(["remove", "init"]);
    expect(wbotMessageListener).toHaveBeenCalledWith(wbot);
    expect(wbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);
  });

  it("removes any existing WhatsApp session before starting a new one", async () => {
    const calls: string[] = [];
    (removeWbot as jest.Mock).mockImplementation(() => calls.push("remove"));
    (initWbot as jest.Mock).mockImplementation(async () => {
      calls.push("init");
      return wbot;
    });

    await StartWhatsAppSession(whatsapp as any);

    expect(removeWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(initWbot).toHaveBeenCalledWith(whatsapp);
    expect(calls).toEqual(["remove", "init"]);
  });
});
