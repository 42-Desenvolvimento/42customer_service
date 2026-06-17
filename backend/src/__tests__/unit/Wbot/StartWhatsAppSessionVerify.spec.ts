import { initWbot, removeWbot } from "../../../libs/wbot";
import { getIO } from "../../../libs/socket";
import Whatsapp from "../../../models/Whatsapp";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { wbotMessageListener } from "../../../services/WbotServices/wbotMessageListener";
import wbotMonitor from "../../../services/WbotServices/wbotMonitor";

const mockEmit = jest.fn();

jest.mock("../../../libs/wbot", () => ({
  initWbot: jest.fn(),
  removeWbot: jest.fn()
}));

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn(() => ({
    emit: mockEmit
  }))
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
  const initWbotMock = initWbot as jest.Mock;
  const removeWbotMock = removeWbot as jest.Mock;
  const findByPkMock = Whatsapp.findByPk as jest.Mock;
  const getIOMock = getIO as jest.Mock;
  const wbotMessageListenerMock = wbotMessageListener as jest.Mock;
  const wbotMonitorMock = wbotMonitor as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("removes stale session before initializing recovery client", async () => {
    const whatsapp = {
      id: 12,
      tenantId: 34,
      update: jest.fn().mockResolvedValue(undefined)
    };
    const wbot = { id: 12 };

    findByPkMock.mockResolvedValue(whatsapp);
    initWbotMock.mockImplementation(async () => {
      expect(removeWbotMock).toHaveBeenCalledWith(12);
      return wbot;
    });

    await StartWhatsAppSessionVerify(12, "Error: session closed");

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(mockEmit).toHaveBeenCalledWith("34:whatsappSession", {
      action: "update",
      session: whatsapp
    });
    expect(initWbotMock).toHaveBeenCalledWith(whatsapp);
    expect(wbotMessageListenerMock).toHaveBeenCalledWith(wbot);
    expect(wbotMonitorMock).toHaveBeenCalledWith(wbot, whatsapp);
    expect(getIOMock).toHaveBeenCalledTimes(1);
  });

  it("recovers when sendSeen fails with undefined client", async () => {
    const whatsapp = {
      id: 56,
      tenantId: 78,
      update: jest.fn().mockResolvedValue(undefined)
    };
    const wbot = { id: 56 };

    findByPkMock.mockResolvedValue(whatsapp);
    initWbotMock.mockResolvedValue(wbot);

    await StartWhatsAppSessionVerify(
      56,
      new TypeError("Cannot read property 'sendSeen' of undefined")
    );

    expect(removeWbotMock).toHaveBeenCalledWith(56);
    expect(initWbotMock).toHaveBeenCalledWith(whatsapp);
  });

  it("ignores unrelated errors", async () => {
    await StartWhatsAppSessionVerify(12, "network timeout");

    expect(findByPkMock).not.toHaveBeenCalled();
    expect(removeWbotMock).not.toHaveBeenCalled();
    expect(initWbotMock).not.toHaveBeenCalled();
  });
});
