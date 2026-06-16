import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { initWbot, removeWbot } from "../../../libs/wbot";
import { getIO } from "../../../libs/socket";
import Whatsapp from "../../../models/Whatsapp";
import { wbotMessageListener } from "../../../services/WbotServices/wbotMessageListener";
import wbotMonitor from "../../../services/WbotServices/wbotMonitor";

jest.mock("../../../libs/wbot", () => ({
  initWbot: jest.fn(),
  removeWbot: jest.fn()
}));

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn()
}));

jest.mock("../../../models/Whatsapp", () => ({
  findByPk: jest.fn()
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
  it("removes the stale whatsapp client before starting a replacement session", async () => {
    const emit = jest.fn();
    const whatsapp = {
      id: 42,
      tenantId: 7,
      update: jest.fn().mockResolvedValue(undefined)
    };
    const wbot = { id: 42 };

    (Whatsapp.findByPk as jest.Mock).mockResolvedValue(whatsapp);
    (getIO as jest.Mock).mockReturnValue({ emit });
    (initWbot as jest.Mock).mockResolvedValue(wbot);

    await StartWhatsAppSessionVerify(42, new Error("Session closed"));

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(emit).toHaveBeenCalledWith("7:whatsappSession", {
      action: "update",
      session: whatsapp
    });
    expect(removeWbot).toHaveBeenCalledWith(42);
    expect(initWbot).toHaveBeenCalledWith(whatsapp);
    expect(wbotMessageListener).toHaveBeenCalledWith(wbot);
    expect(wbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);

    const removeOrder = (removeWbot as jest.Mock).mock.invocationCallOrder[0];
    const initOrder = (initWbot as jest.Mock).mock.invocationCallOrder[0];
    expect(removeOrder).toBeLessThan(initOrder);
  });

  it("recovers from sendSeen undefined errors case-insensitively", async () => {
    const whatsapp = {
      id: 43,
      tenantId: 8,
      update: jest.fn().mockResolvedValue(undefined)
    };

    (Whatsapp.findByPk as jest.Mock).mockResolvedValue(whatsapp);
    (getIO as jest.Mock).mockReturnValue({ emit: jest.fn() });
    (initWbot as jest.Mock).mockResolvedValue({ id: 43 });

    await StartWhatsAppSessionVerify(
      43,
      "TypeError: Cannot read property 'sendSeen' of undefined"
    );

    expect(removeWbot).toHaveBeenCalledWith(43);
    expect(initWbot).toHaveBeenCalledWith(whatsapp);
  });
});
