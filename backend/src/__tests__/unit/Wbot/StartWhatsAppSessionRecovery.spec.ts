import Whatsapp from "../../../models/Whatsapp";
import { getIO } from "../../../libs/socket";
import { initWbot, removeWbot } from "../../../libs/wbot";
import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
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

jest.mock(
  "../../../services/InstagramBotServices/StartInstaBotSession",
  () => ({
    StartInstaBotSession: jest.fn()
  })
);

jest.mock("../../../services/TbotServices/StartTbotSession", () => ({
  StartTbotSession: jest.fn()
}));

jest.mock("../../../services/WABA360/StartWaba360", () => ({
  StartWaba360: jest.fn()
}));

jest.mock(
  "../../../services/MessengerChannelServices/StartMessengerBot",
  () => ({
    StartMessengerBot: jest.fn()
  })
);

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

describe("WhatsApp session recovery", () => {
  const mockedWhatsapp = Whatsapp as unknown as {
    findByPk: jest.Mock;
  };
  const mockedGetIO = getIO as jest.Mock;
  const mockedInitWbot = initWbot as jest.Mock;
  const mockedRemoveWbot = removeWbot as jest.Mock;
  const mockedWbotMessageListener = wbotMessageListener as jest.Mock;
  const mockedWbotMonitor = wbotMonitor as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetIO.mockReturnValue({ emit: jest.fn() });
  });

  it("removes a stale session before recovering from sendSeen failures", async () => {
    const calls: string[] = [];
    const whatsapp = {
      id: 42,
      tenantId: 7,
      update: jest.fn().mockResolvedValue(undefined)
    };
    const wbot = { id: 42 };

    mockedWhatsapp.findByPk.mockResolvedValue(whatsapp);
    mockedRemoveWbot.mockImplementation(async () => {
      calls.push("remove");
    });
    mockedInitWbot.mockImplementation(async () => {
      calls.push("init");
      return wbot;
    });

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      new Error("TypeError: Cannot read property 'sendSeen' of undefined")
    );

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(mockedRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockedInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(calls).toEqual(["remove", "init"]);
    expect(mockedWbotMessageListener).toHaveBeenCalledWith(wbot);
    expect(mockedWbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);
  });

  it("removes a stale session before starting a whatsapp connection", async () => {
    const calls: string[] = [];
    const whatsapp = {
      id: 24,
      tenantId: 7,
      type: "whatsapp",
      update: jest.fn().mockResolvedValue(undefined)
    };
    const wbot = { id: 24 };

    mockedRemoveWbot.mockImplementation(async () => {
      calls.push("remove");
    });
    mockedInitWbot.mockImplementation(async () => {
      calls.push("init");
      return wbot;
    });

    await StartWhatsAppSession(whatsapp as any);

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(mockedRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockedInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(calls).toEqual(["remove", "init"]);
    expect(mockedWbotMessageListener).toHaveBeenCalledWith(wbot);
    expect(mockedWbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);
  });
});
