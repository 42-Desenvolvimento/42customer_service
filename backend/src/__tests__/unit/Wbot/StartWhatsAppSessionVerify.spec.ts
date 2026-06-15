import { getIO } from "../../../libs/socket";
import { initWbot, removeWbot } from "../../../libs/wbot";
import Whatsapp from "../../../models/Whatsapp";
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

describe("StartWhatsAppSessionVerify", () => {
  const emit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (getIO as jest.Mock).mockReturnValue({ emit });
  });

  it("removes the stale client before starting a recovered session", async () => {
    const whatsapp = {
      id: 10,
      tenantId: 1,
      update: jest.fn()
    };
    const wbot = { id: 10 };

    (Whatsapp.findByPk as jest.Mock).mockResolvedValue(whatsapp);
    (initWbot as jest.Mock).mockResolvedValue(wbot);

    await StartWhatsAppSessionVerify(whatsapp.id, new Error("Session closed"));

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(emit).toHaveBeenCalledWith("1:whatsappSession", {
      action: "update",
      session: whatsapp
    });
    expect(removeWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(initWbot).toHaveBeenCalledWith(whatsapp);
    expect(
      (removeWbot as jest.Mock).mock.invocationCallOrder[0]
    ).toBeLessThan((initWbot as jest.Mock).mock.invocationCallOrder[0]);
    expect(wbotMessageListener).toHaveBeenCalledWith(wbot);
    expect(wbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);
  });

  it("recovers sessions from sendSeen undefined errors", async () => {
    const whatsapp = {
      id: 11,
      tenantId: 2,
      update: jest.fn()
    };

    (Whatsapp.findByPk as jest.Mock).mockResolvedValue(whatsapp);
    (initWbot as jest.Mock).mockResolvedValue({ id: whatsapp.id });

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      "TypeError: Cannot read property 'sendSeen' of undefined"
    );

    expect(removeWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(initWbot).toHaveBeenCalledWith(whatsapp);
  });

  it("ignores unrelated errors", async () => {
    await StartWhatsAppSessionVerify(12, new Error("rate limited"));

    expect(Whatsapp.findByPk).not.toHaveBeenCalled();
    expect(removeWbot).not.toHaveBeenCalled();
    expect(initWbot).not.toHaveBeenCalled();
  });
});
