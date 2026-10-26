import Whatsapp from "../../../models/Whatsapp";
import { getIO } from "../../../libs/socket";
import { initWbot, removeWbot } from "../../../libs/wbot";
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

jest.mock("../../../services/WbotServices/wbotMonitor", () => jest.fn());

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn()
  }
}));

describe("StartWhatsAppSessionVerify", () => {
  const emit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (getIO as jest.Mock).mockReturnValue({ emit });
    (initWbot as jest.Mock).mockResolvedValue("wbot");
    (removeWbot as jest.Mock).mockResolvedValue(undefined);
  });

  it("should remove the stale whatsapp session before starting recovery", async () => {
    const whatsapp = {
      id: 10,
      tenantId: 5,
      update: jest.fn().mockResolvedValue(undefined)
    };
    (Whatsapp.findByPk as jest.Mock).mockResolvedValue(whatsapp);

    await StartWhatsAppSessionVerify(
      10,
      new TypeError("Cannot read property 'sendSeen' of undefined")
    );

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(emit).toHaveBeenCalledWith("5:whatsappSession", {
      action: "update",
      session: whatsapp
    });
    expect(removeWbot).toHaveBeenCalledWith(10);
    expect(initWbot).toHaveBeenCalledWith(whatsapp);
    expect((removeWbot as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (initWbot as jest.Mock).mock.invocationCallOrder[0]
    );
    expect(wbotMessageListener).toHaveBeenCalledWith("wbot");
    expect(wbotMonitor).toHaveBeenCalledWith("wbot", whatsapp);
  });

  it("should ignore unrelated errors", async () => {
    await StartWhatsAppSessionVerify(10, new Error("network timeout"));

    expect(Whatsapp.findByPk).not.toHaveBeenCalled();
    expect(removeWbot).not.toHaveBeenCalled();
    expect(initWbot).not.toHaveBeenCalled();
  });
});
