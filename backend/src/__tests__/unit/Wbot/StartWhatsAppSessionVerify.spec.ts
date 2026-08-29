import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import Whatsapp from "../../../models/Whatsapp";
import { getIO } from "../../../libs/socket";
import { initWbot, removeWbot } from "../../../libs/wbot";
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

const findByPkMock = Whatsapp.findByPk as jest.Mock;
const getIOMock = getIO as jest.Mock;
const initWbotMock = initWbot as jest.Mock;
const removeWbotMock = removeWbot as jest.Mock;
const wbotMessageListenerMock = wbotMessageListener as jest.Mock;
const wbotMonitorMock = wbotMonitor as jest.Mock;

describe("StartWhatsAppSessionVerify", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("replaces the cached session before recovering from sendSeen failures", async () => {
    const callOrder: string[] = [];
    const whatsapp = {
      id: 42,
      tenantId: 7,
      update: jest.fn().mockResolvedValue(undefined)
    };
    const io = { emit: jest.fn() };
    const wbot = { id: whatsapp.id };

    findByPkMock.mockResolvedValue(whatsapp);
    getIOMock.mockReturnValue(io);
    removeWbotMock.mockImplementation(() => callOrder.push("removeWbot"));
    initWbotMock.mockImplementation(async () => {
      callOrder.push("initWbot");
      return wbot;
    });

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      new TypeError("Cannot read property 'sendSeen' of undefined")
    );

    expect(findByPkMock).toHaveBeenCalledWith(whatsapp.id);
    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(io.emit).toHaveBeenCalledWith(`${whatsapp.tenantId}:whatsappSession`, {
      action: "update",
      session: whatsapp
    });
    expect(removeWbotMock).toHaveBeenCalledWith(whatsapp.id);
    expect(initWbotMock).toHaveBeenCalledWith(whatsapp);
    expect(callOrder).toEqual(["removeWbot", "initWbot"]);
    expect(wbotMessageListenerMock).toHaveBeenCalledWith(wbot);
    expect(wbotMonitorMock).toHaveBeenCalledWith(wbot, whatsapp);
  });

  it("does not restart whatsapp for unrelated errors", async () => {
    await StartWhatsAppSessionVerify(42, new Error("media file not found"));

    expect(findByPkMock).not.toHaveBeenCalled();
    expect(removeWbotMock).not.toHaveBeenCalled();
    expect(initWbotMock).not.toHaveBeenCalled();
  });
});
