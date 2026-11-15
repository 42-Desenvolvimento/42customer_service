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

import { initWbot, removeWbot } from "../../../libs/wbot";
import { getIO } from "../../../libs/socket";
import Whatsapp from "../../../models/Whatsapp";
import { wbotMessageListener } from "../../../services/WbotServices/wbotMessageListener";
import wbotMonitor from "../../../services/WbotServices/wbotMonitor";
import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

const initWbotMock = initWbot as jest.Mock;
const removeWbotMock = removeWbot as jest.Mock;
const getIOMock = getIO as jest.Mock;
const findByPkMock = Whatsapp.findByPk as jest.Mock;
const wbotMessageListenerMock = wbotMessageListener as jest.Mock;
const wbotMonitorMock = wbotMonitor as jest.Mock;

describe("WhatsApp session recovery", () => {
  const emit = jest.fn();
  const wbot = { id: 7 };

  const makeWhatsapp = () =>
    ({
      id: 7,
      tenantId: 42,
      type: "whatsapp",
      update: jest.fn().mockResolvedValue(undefined)
    } as any);

  beforeEach(() => {
    jest.clearAllMocks();
    getIOMock.mockReturnValue({ emit });
    initWbotMock.mockResolvedValue(wbot);
    removeWbotMock.mockResolvedValue(undefined);
  });

  it("recovers sendSeen disconnection errors after removing the stale session", async () => {
    const whatsapp = makeWhatsapp();
    findByPkMock.mockResolvedValue(whatsapp);

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      new Error("TypeError: Cannot read property 'sendSeen' of undefined")
    );

    expect(findByPkMock).toHaveBeenCalledWith(whatsapp.id);
    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(emit).toHaveBeenCalledWith("42:whatsappSession", {
      action: "update",
      session: whatsapp
    });
    expect(removeWbotMock).toHaveBeenCalledWith(whatsapp.id);
    expect(initWbotMock).toHaveBeenCalledWith(whatsapp);
    expect(
      removeWbotMock.mock.invocationCallOrder[0]
    ).toBeLessThan(initWbotMock.mock.invocationCallOrder[0]);
    expect(wbotMessageListenerMock).toHaveBeenCalledWith(wbot);
    expect(wbotMonitorMock).toHaveBeenCalledWith(wbot, whatsapp);
  });

  it("ignores unrelated send errors", async () => {
    await StartWhatsAppSessionVerify(7, new Error("invalid media format"));

    expect(findByPkMock).not.toHaveBeenCalled();
    expect(removeWbotMock).not.toHaveBeenCalled();
    expect(initWbotMock).not.toHaveBeenCalled();
  });

  it("removes an existing whatsapp client before starting a new session", async () => {
    const whatsapp = makeWhatsapp();

    await StartWhatsAppSession(whatsapp);

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(removeWbotMock).toHaveBeenCalledWith(whatsapp.id);
    expect(initWbotMock).toHaveBeenCalledWith(whatsapp);
    expect(
      removeWbotMock.mock.invocationCallOrder[0]
    ).toBeLessThan(initWbotMock.mock.invocationCallOrder[0]);
    expect(wbotMessageListenerMock).toHaveBeenCalledWith(wbot);
    expect(wbotMonitorMock).toHaveBeenCalledWith(wbot, whatsapp);
  });
});
