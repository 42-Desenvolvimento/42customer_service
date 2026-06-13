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
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

describe("StartWhatsAppSessionVerify", () => {
  const emit = jest.fn();
  const whatsapp = {
    id: 10,
    tenantId: 42,
    update: jest.fn()
  };
  const wbot = { id: 10 };

  beforeEach(() => {
    emit.mockClear();
    whatsapp.update.mockResolvedValue(undefined);
    (getIO as jest.Mock).mockReturnValue({ emit });
    (Whatsapp.findByPk as jest.Mock).mockResolvedValue(whatsapp);
    (removeWbot as jest.Mock).mockResolvedValue(undefined);
    (initWbot as jest.Mock).mockResolvedValue(wbot);
  });

  it("removes the stale client before initializing a recovered session", async () => {
    await StartWhatsAppSessionVerify(10, new Error("Protocol error: Session closed"));

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(removeWbot).toHaveBeenCalledWith(10);
    expect(initWbot).toHaveBeenCalledWith(whatsapp);
    expect(wbotMessageListener).toHaveBeenCalledWith(wbot);
    expect(wbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);
    expect((removeWbot as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (initWbot as jest.Mock).mock.invocationCallOrder[0]
    );
  });

  it("does not restart the session for unrelated errors", async () => {
    await StartWhatsAppSessionVerify(10, new Error("validation failed"));

    expect(Whatsapp.findByPk).not.toHaveBeenCalled();
    expect(removeWbot).not.toHaveBeenCalled();
    expect(initWbot).not.toHaveBeenCalled();
  });
});
