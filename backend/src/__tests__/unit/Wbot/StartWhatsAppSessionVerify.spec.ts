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

describe("StartWhatsAppSessionVerify", () => {
  const findByPkMock = Whatsapp.findByPk as jest.Mock;
  const initWbotMock = initWbot as jest.Mock;
  const removeWbotMock = removeWbot as jest.Mock;
  const getIOMock = getIO as jest.Mock;
  const wbotMessageListenerMock = wbotMessageListener as jest.Mock;
  const wbotMonitorMock = wbotMonitor as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("removes the stale session before restarting when sendSeen fails", async () => {
    const emit = jest.fn();
    const wbot = {};
    const whatsapp = {
      id: 7,
      tenantId: 3,
      update: jest.fn()
    };

    findByPkMock.mockResolvedValue(whatsapp);
    getIOMock.mockReturnValue({ emit });
    initWbotMock.mockResolvedValue(wbot);

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      new TypeError("Cannot read property 'sendSeen' of undefined")
    );

    expect(findByPkMock).toHaveBeenCalledWith(whatsapp.id);
    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(emit).toHaveBeenCalledWith(`${whatsapp.tenantId}:whatsappSession`, {
      action: "update",
      session: whatsapp
    });
    expect(removeWbotMock).toHaveBeenCalledWith(whatsapp.id);
    expect(initWbotMock).toHaveBeenCalledWith(whatsapp);
    expect(wbotMessageListenerMock).toHaveBeenCalledWith(wbot);
    expect(wbotMonitorMock).toHaveBeenCalledWith(wbot, whatsapp);
    expect(removeWbotMock.mock.invocationCallOrder[0]).toBeLessThan(
      initWbotMock.mock.invocationCallOrder[0]
    );
  });

  it("does not restart for unrelated errors", async () => {
    await StartWhatsAppSessionVerify(7, new Error("rate limited"));

    expect(findByPkMock).not.toHaveBeenCalled();
    expect(removeWbotMock).not.toHaveBeenCalled();
    expect(initWbotMock).not.toHaveBeenCalled();
  });
});
