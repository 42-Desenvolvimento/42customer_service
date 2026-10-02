import { getIO } from "../../../libs/socket";
import { initWbot, removeWbot } from "../../../libs/wbot";
import Whatsapp from "../../../models/Whatsapp";
import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { wbotMessageListener } from "../../../services/WbotServices/wbotMessageListener";
import wbotMonitor from "../../../services/WbotServices/wbotMonitor";

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn()
}));

jest.mock("../../../libs/wbot", () => ({
  initWbot: jest.fn(),
  removeWbot: jest.fn()
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

const getIOMock = getIO as jest.MockedFunction<typeof getIO>;
const initWbotMock = initWbot as jest.MockedFunction<typeof initWbot>;
const removeWbotMock = removeWbot as jest.MockedFunction<typeof removeWbot>;
const findByPkMock = Whatsapp.findByPk as jest.Mock;
const wbotMessageListenerMock = wbotMessageListener as jest.MockedFunction<
  typeof wbotMessageListener
>;
const wbotMonitorMock = wbotMonitor as jest.MockedFunction<typeof wbotMonitor>;

describe("WhatsApp session recovery", () => {
  const emit = jest.fn();
  const wbot = { id: 10 };

  beforeEach(() => {
    jest.clearAllMocks();
    getIOMock.mockReturnValue({ emit } as never);
    initWbotMock.mockResolvedValue(wbot as never);
    removeWbotMock.mockResolvedValue();
  });

  const makeWhatsapp = () =>
    ({
      id: 10,
      tenantId: 3,
      type: "whatsapp",
      update: jest.fn().mockResolvedValue(undefined)
    } as unknown as Whatsapp);

  it("removes the stale session before recovering from a sendSeen failure", async () => {
    const whatsapp = makeWhatsapp();
    const calls: string[] = [];
    findByPkMock.mockResolvedValue(whatsapp);
    removeWbotMock.mockImplementation(async () => {
      calls.push("remove");
    });
    initWbotMock.mockImplementation(async () => {
      calls.push("init");
      return wbot as never;
    });

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      new Error("TypeError: Cannot read property 'sendSeen' of undefined")
    );

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(emit).toHaveBeenCalledWith("3:whatsappSession", {
      action: "update",
      session: whatsapp
    });
    expect(removeWbotMock).toHaveBeenCalledWith(whatsapp.id);
    expect(initWbotMock).toHaveBeenCalledWith(whatsapp);
    expect(calls).toEqual(["remove", "init"]);
    expect(wbotMessageListenerMock).toHaveBeenCalledWith(wbot);
    expect(wbotMonitorMock).toHaveBeenCalledWith(wbot, whatsapp);
  });

  it("ignores errors that do not indicate a broken WhatsApp session", async () => {
    await StartWhatsAppSessionVerify(10, new Error("temporary network error"));

    expect(findByPkMock).not.toHaveBeenCalled();
    expect(removeWbotMock).not.toHaveBeenCalled();
    expect(initWbotMock).not.toHaveBeenCalled();
  });

  it("removes the old client before starting a WhatsApp session manually", async () => {
    const whatsapp = makeWhatsapp();
    const calls: string[] = [];
    removeWbotMock.mockImplementation(async () => {
      calls.push("remove");
    });
    initWbotMock.mockImplementation(async () => {
      calls.push("init");
      return wbot as never;
    });

    await StartWhatsAppSession(whatsapp);

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(removeWbotMock).toHaveBeenCalledWith(whatsapp.id);
    expect(initWbotMock).toHaveBeenCalledWith(whatsapp);
    expect(calls).toEqual(["remove", "init"]);
  });
});
