import Whatsapp from "../../../models/Whatsapp";
import { getIO } from "../../../libs/socket";
import { initWbot, removeWbot } from "../../../libs/wbot";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { wbotMessageListener } from "../../../services/WbotServices/wbotMessageListener";
import wbotMonitor from "../../../services/WbotServices/wbotMonitor";

jest.mock("../../../models/Whatsapp", () => ({
  findByPk: jest.fn()
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
  const findByPkMock = Whatsapp.findByPk as jest.Mock;
  const getIOMock = getIO as jest.Mock;
  const initWbotMock = initWbot as jest.Mock;
  const removeWbotMock = removeWbot as jest.Mock;
  const wbotMessageListenerMock = wbotMessageListener as jest.Mock;
  const wbotMonitorMock = wbotMonitor as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    getIOMock.mockReturnValue({ emit: jest.fn() });
  });

  it("substitui a sessão antiga antes de reiniciar em erro de sendSeen", async () => {
    const callOrder: string[] = [];
    const whatsapp = {
      id: 42,
      tenantId: 7,
      update: jest.fn().mockResolvedValue(undefined)
    };
    const wbot = { id: 42 };

    findByPkMock.mockResolvedValue(whatsapp);
    removeWbotMock.mockImplementation(async () => {
      callOrder.push("remove");
    });
    initWbotMock.mockImplementation(async () => {
      callOrder.push("init");
      return wbot;
    });

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      new TypeError("Cannot read property 'sendSeen' of undefined")
    );

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(removeWbotMock).toHaveBeenCalledWith(whatsapp.id);
    expect(initWbotMock).toHaveBeenCalledWith(whatsapp);
    expect(callOrder).toEqual(["remove", "init"]);
    expect(wbotMessageListenerMock).toHaveBeenCalledWith(wbot);
    expect(wbotMonitorMock).toHaveBeenCalledWith(wbot, whatsapp);
  });

  it("ignora erros que nao indicam sessao quebrada", async () => {
    await StartWhatsAppSessionVerify(42, new Error("invalidNumber"));

    expect(findByPkMock).not.toHaveBeenCalled();
    expect(removeWbotMock).not.toHaveBeenCalled();
    expect(initWbotMock).not.toHaveBeenCalled();
  });
});
