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

const mockedGetIO = getIO as jest.Mock;
const mockedInitWbot = initWbot as jest.Mock;
const mockedRemoveWbot = removeWbot as jest.Mock;
const mockedFindByPk = Whatsapp.findByPk as jest.Mock;
const mockedMessageListener = wbotMessageListener as jest.Mock;
const mockedMonitor = wbotMonitor as jest.Mock;

const buildWhatsapp = () => ({
  id: 123,
  tenantId: 456,
  type: "whatsapp",
  update: jest.fn().mockResolvedValue(undefined)
});

describe("StartWhatsAppSession recovery", () => {
  let calls: string[];
  const wbot = { id: 123 };
  const emit = jest.fn();

  beforeEach(() => {
    calls = [];
    jest.clearAllMocks();

    mockedGetIO.mockReturnValue({ emit });
    mockedRemoveWbot.mockImplementation(() => {
      calls.push("remove");
    });
    mockedInitWbot.mockImplementation(async () => {
      calls.push("init");
      return wbot;
    });
  });

  it("replaces the stale session before recovering from sendSeen failures", async () => {
    const whatsapp = buildWhatsapp();
    mockedFindByPk.mockResolvedValue(whatsapp);

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      new Error("TypeError: Cannot read property 'sendSeen' of undefined")
    );

    expect(mockedFindByPk).toHaveBeenCalledWith(whatsapp.id);
    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(emit).toHaveBeenCalledWith(`${whatsapp.tenantId}:whatsappSession`, {
      action: "update",
      session: whatsapp
    });
    expect(mockedRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockedInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(calls).toEqual(["remove", "init"]);
    expect(mockedMessageListener).toHaveBeenCalledWith(wbot);
    expect(mockedMonitor).toHaveBeenCalledWith(wbot, whatsapp);
  });

  it("replaces the stale session before starting a WhatsApp channel", async () => {
    const whatsapp = buildWhatsapp();

    await StartWhatsAppSession(whatsapp as any);

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(emit).toHaveBeenCalledWith(`${whatsapp.tenantId}:whatsappSession`, {
      action: "update",
      session: whatsapp
    });
    expect(mockedRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockedInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(calls).toEqual(["remove", "init"]);
    expect(mockedMessageListener).toHaveBeenCalledWith(wbot);
    expect(mockedMonitor).toHaveBeenCalledWith(wbot, whatsapp);
  });
});
