import { initWbot, removeWbot } from "../../../libs/wbot";
import { getIO } from "../../../libs/socket";
import Whatsapp from "../../../models/Whatsapp";
import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";
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

const initWbotMock = initWbot as jest.Mock;
const removeWbotMock = removeWbot as jest.Mock;
const getIOMock = getIO as jest.Mock;
const findByPkMock = Whatsapp.findByPk as jest.Mock;
const wbotMessageListenerMock = wbotMessageListener as jest.Mock;
const wbotMonitorMock = wbotMonitor as jest.Mock;

describe("StartWhatsAppSession recovery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getIOMock.mockReturnValue({ emit: jest.fn() });
    initWbotMock.mockResolvedValue({ id: 7 });
  });

  it("removes a cached whatsapp session before starting it again", async () => {
    const calls: string[] = [];
    const whatsapp = {
      id: 7,
      tenantId: 3,
      type: "whatsapp",
      update: jest.fn().mockResolvedValue(undefined)
    } as any;

    removeWbotMock.mockImplementation(() => calls.push("remove"));
    initWbotMock.mockImplementation(async () => {
      calls.push("init");
      return { id: whatsapp.id };
    });

    await StartWhatsAppSession(whatsapp);

    expect(removeWbotMock).toHaveBeenCalledWith(whatsapp.id);
    expect(initWbotMock).toHaveBeenCalledWith(whatsapp);
    expect(calls).toEqual(["remove", "init"]);
    expect(wbotMessageListenerMock).toHaveBeenCalledWith({ id: whatsapp.id });
    expect(wbotMonitorMock).toHaveBeenCalledWith({ id: whatsapp.id }, whatsapp);
  });

  it.each([
    new TypeError("Cannot read property 'sendSeen' of undefined"),
    new TypeError("Cannot read properties of undefined (reading 'sendSeen')")
  ])(
    "recovers sendSeen failures by removing the stale session before initWbot",
    async error => {
      const calls: string[] = [];
      const whatsapp = {
        id: 7,
        tenantId: 3,
        update: jest.fn().mockResolvedValue(undefined)
      } as any;

      findByPkMock.mockResolvedValue(whatsapp);
      removeWbotMock.mockImplementation(() => calls.push("remove"));
      initWbotMock.mockImplementation(async () => {
        calls.push("init");
        return { id: whatsapp.id };
      });

      await StartWhatsAppSessionVerify(whatsapp.id, error);

      expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
      expect(removeWbotMock).toHaveBeenCalledWith(whatsapp.id);
      expect(initWbotMock).toHaveBeenCalledWith(whatsapp);
      expect(calls).toEqual(["remove", "init"]);
    }
  );

  it("does not restart the session for unrelated errors", async () => {
    await StartWhatsAppSessionVerify(7, new Error("rate limited"));

    expect(findByPkMock).not.toHaveBeenCalled();
    expect(removeWbotMock).not.toHaveBeenCalled();
    expect(initWbotMock).not.toHaveBeenCalled();
  });
});
