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

jest.mock("../../../services/WbotServices/wbotMonitor", () => jest.fn());

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

const mockedInitWbot = initWbot as jest.Mock;
const mockedRemoveWbot = removeWbot as jest.Mock;
const mockedGetIO = getIO as jest.Mock;
const mockedFindByPk = Whatsapp.findByPk as jest.Mock;

describe("StartWhatsAppSession recovery", () => {
  const wbot = { id: 123 };
  const whatsapp: any = {
    id: 123,
    tenantId: 456,
    type: "whatsapp",
    update: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    whatsapp.update.mockResolvedValue(whatsapp);
    mockedGetIO.mockReturnValue({ emit: jest.fn() });
    mockedInitWbot.mockResolvedValue(wbot);
    mockedFindByPk.mockResolvedValue(whatsapp);
  });

  it("removes stale in-memory session before verified recovery starts a new client", async () => {
    const calls: string[] = [];
    mockedRemoveWbot.mockImplementation(() => calls.push("remove"));
    mockedInitWbot.mockImplementation(async () => {
      calls.push("init");
      return wbot;
    });

    await StartWhatsAppSessionVerify(whatsapp.id, "Error: Session closed");

    expect(mockedRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockedInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(calls).toEqual(["remove", "init"]);
    expect(wbotMessageListener).toHaveBeenCalledWith(wbot);
    expect(wbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);
  });

  it("recovers when sendSeen fails with a disconnected client", async () => {
    await StartWhatsAppSessionVerify(
      whatsapp.id,
      new TypeError("Cannot read property 'sendSeen' of undefined")
    );

    expect(mockedRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockedInitWbot).toHaveBeenCalledWith(whatsapp);
  });

  it("removes stale in-memory session before a whatsapp session restart", async () => {
    const calls: string[] = [];
    mockedRemoveWbot.mockImplementation(() => calls.push("remove"));
    mockedInitWbot.mockImplementation(async () => {
      calls.push("init");
      return wbot;
    });

    await StartWhatsAppSession(whatsapp);

    expect(mockedRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockedInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(calls).toEqual(["remove", "init"]);
  });
});
