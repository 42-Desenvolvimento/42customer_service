import { initWbot, removeWbot } from "../../../libs/wbot";
import Whatsapp from "../../../models/Whatsapp";
import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { wbotMessageListener } from "../../../services/WbotServices/wbotMessageListener";
import wbotMonitor from "../../../services/WbotServices/wbotMonitor";

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn(() => ({ emit: jest.fn() }))
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

jest.mock("../../../services/WbotServices/wbotMonitor", () => jest.fn());

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

const mockedInitWbot = initWbot as unknown as jest.Mock;
const mockedRemoveWbot = removeWbot as unknown as jest.Mock;
const mockedWhatsapp = Whatsapp as unknown as { findByPk: jest.Mock };
const mockedWbotMessageListener = wbotMessageListener as jest.Mock;
const mockedWbotMonitor = wbotMonitor as jest.Mock;

const createWhatsapp = () => ({
  id: 42,
  tenantId: 7,
  type: "whatsapp",
  update: jest.fn()
});

describe("WhatsApp session recovery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("replaces the stale client before recovering from sendSeen failures", async () => {
    const whatsapp = createWhatsapp();
    const wbot = { id: whatsapp.id };
    const callOrder: string[] = [];

    mockedWhatsapp.findByPk.mockResolvedValue(whatsapp);
    mockedRemoveWbot.mockImplementation(async () => {
      callOrder.push("remove");
    });
    mockedInitWbot.mockImplementation(async () => {
      callOrder.push("init");
      return wbot;
    });

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      new TypeError("Cannot read property 'sendSeen' of undefined")
    );

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(mockedRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockedInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(callOrder).toEqual(["remove", "init"]);
    expect(mockedWbotMessageListener).toHaveBeenCalledWith(wbot);
    expect(mockedWbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);
  });

  it("removes an existing WhatsApp client before starting a new session", async () => {
    const whatsapp = createWhatsapp();
    const wbot = { id: whatsapp.id };
    const callOrder: string[] = [];

    mockedRemoveWbot.mockImplementation(async () => {
      callOrder.push("remove");
    });
    mockedInitWbot.mockImplementation(async () => {
      callOrder.push("init");
      return wbot;
    });

    await StartWhatsAppSession(whatsapp as any);

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(mockedRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockedInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(callOrder).toEqual(["remove", "init"]);
    expect(mockedWbotMessageListener).toHaveBeenCalledWith(wbot);
    expect(mockedWbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);
  });
});
