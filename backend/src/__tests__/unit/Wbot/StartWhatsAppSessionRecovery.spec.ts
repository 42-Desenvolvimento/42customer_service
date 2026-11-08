import { initWbot, removeWbot } from "../../../libs/wbot";
import { getIO } from "../../../libs/socket";
import Whatsapp from "../../../models/Whatsapp";
import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import wbotMonitor from "../../../services/WbotServices/wbotMonitor";
import { wbotMessageListener } from "../../../services/WbotServices/wbotMessageListener";

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

jest.mock("../../../services/InstagramBotServices/StartInstaBotSession", () => ({
  StartInstaBotSession: jest.fn()
}));

jest.mock("../../../services/TbotServices/StartTbotSession", () => ({
  StartTbotSession: jest.fn()
}));

jest.mock("../../../services/WABA360/StartWaba360", () => ({
  StartWaba360: jest.fn()
}));

jest.mock("../../../services/MessengerChannelServices/StartMessengerBot", () => ({
  StartMessengerBot: jest.fn()
}));

describe("WhatsApp session recovery", () => {
  const initWbotMock = initWbot as jest.Mock;
  const removeWbotMock = removeWbot as jest.Mock;
  const getIOMock = getIO as jest.Mock;
  const findByPkMock = Whatsapp.findByPk as jest.Mock;
  const wbotMessageListenerMock = wbotMessageListener as jest.Mock;
  const wbotMonitorMock = wbotMonitor as jest.Mock;

  const emitMock = jest.fn();
  const wbot = { id: 7 };

  const buildWhatsapp = () =>
    ({
      id: 7,
      name: "support",
      tenantId: 3,
      type: "whatsapp",
      session: "",
      update: jest.fn().mockResolvedValue(undefined)
    } as any);

  beforeEach(() => {
    jest.clearAllMocks();
    getIOMock.mockReturnValue({ emit: emitMock });
    initWbotMock.mockResolvedValue(wbot);
    removeWbotMock.mockResolvedValue(undefined);
  });

  it("removes the cached client before recovering from sendSeen session errors", async () => {
    const whatsapp = buildWhatsapp();
    const order: string[] = [];

    findByPkMock.mockResolvedValue(whatsapp);
    removeWbotMock.mockImplementation(async () => {
      order.push("remove");
    });
    initWbotMock.mockImplementation(async () => {
      order.push("init");
      return wbot;
    });

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      new TypeError("Cannot read property 'sendSeen' of undefined")
    );

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(removeWbotMock).toHaveBeenCalledWith(whatsapp.id);
    expect(initWbotMock).toHaveBeenCalledWith(whatsapp);
    expect(order).toEqual(["remove", "init"]);
    expect(wbotMessageListenerMock).toHaveBeenCalledWith(wbot);
    expect(wbotMonitorMock).toHaveBeenCalledWith(wbot, whatsapp);
  });

  it("removes any previous cached client before starting a whatsapp session", async () => {
    const whatsapp = buildWhatsapp();
    const order: string[] = [];

    removeWbotMock.mockImplementation(async () => {
      order.push("remove");
    });
    initWbotMock.mockImplementation(async () => {
      order.push("init");
      return wbot;
    });

    await StartWhatsAppSession(whatsapp);

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(removeWbotMock).toHaveBeenCalledWith(whatsapp.id);
    expect(initWbotMock).toHaveBeenCalledWith(whatsapp);
    expect(order).toEqual(["remove", "init"]);
    expect(wbotMessageListenerMock).toHaveBeenCalledWith(wbot);
    expect(wbotMonitorMock).toHaveBeenCalledWith(wbot, whatsapp);
  });
});
