import { initWbot } from "../../../libs/wbot";
import { getIO } from "../../../libs/socket";
import Whatsapp from "../../../models/Whatsapp";
import { wbotMessageListener } from "../../../services/WbotServices/wbotMessageListener";
import wbotMonitor from "../../../services/WbotServices/wbotMonitor";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

jest.mock("../../../libs/wbot", () => ({
  initWbot: jest.fn()
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

jest.mock("../../../services/WbotServices/wbotMonitor", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn()
  }
}));

describe("StartWhatsAppSessionVerify", () => {
  it("should reopen the whatsapp session for sendSeen disconnected errors", async () => {
    const whatsapp = {
      id: 44,
      tenantId: 8,
      update: jest.fn().mockResolvedValue(undefined)
    };
    const io = {
      emit: jest.fn()
    };
    const wbot = {
      id: whatsapp.id
    };
    const error = new TypeError(
      "Cannot read property 'sendSeen' of undefined"
    );

    (Whatsapp.findByPk as jest.Mock).mockResolvedValue(whatsapp);
    (getIO as jest.Mock).mockReturnValue(io);
    (initWbot as jest.Mock).mockResolvedValue(wbot);

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      error as unknown as string
    );

    expect(Whatsapp.findByPk).toHaveBeenCalledWith(whatsapp.id);
    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(io.emit).toHaveBeenCalledWith("8:whatsappSession", {
      action: "update",
      session: whatsapp
    });
    expect(initWbot).toHaveBeenCalledWith(whatsapp);
    expect(wbotMessageListener).toHaveBeenCalledWith(wbot);
    expect(wbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);
  });
});
