import { initWbot, removeWbot } from "../../../libs/wbot";
import { getIO } from "../../../libs/socket";
import Whatsapp from "../../../models/Whatsapp";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
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
  beforeEach(() => {
    (getIO as jest.Mock).mockReturnValue({ emit: jest.fn() });
    (removeWbot as jest.Mock).mockResolvedValue(undefined);
    (initWbot as jest.Mock).mockResolvedValue({ id: 42 });
  });

  it("removes the stale session before reinitializing after sendSeen disconnect errors", async () => {
    const whatsapp = {
      id: 42,
      tenantId: 7,
      update: jest.fn().mockResolvedValue(undefined)
    };
    (Whatsapp.findByPk as jest.Mock).mockResolvedValue(whatsapp);

    await StartWhatsAppSessionVerify(
      42,
      new TypeError("Cannot read property 'sendSeen' of undefined")
    );

    expect(Whatsapp.findByPk).toHaveBeenCalledWith(42);
    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(removeWbot).toHaveBeenCalledWith(42);
    expect(initWbot).toHaveBeenCalledWith(whatsapp);
    expect(
      (removeWbot as jest.Mock).mock.invocationCallOrder[0]
    ).toBeLessThan((initWbot as jest.Mock).mock.invocationCallOrder[0]);
    expect(wbotMessageListener).toHaveBeenCalledWith({ id: 42 });
    expect(wbotMonitor).toHaveBeenCalledWith({ id: 42 }, whatsapp);
  });
});
