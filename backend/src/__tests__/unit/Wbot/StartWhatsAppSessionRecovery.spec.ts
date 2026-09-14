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

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

const mockedInitWbot = initWbot as jest.Mock;
const mockedRemoveWbot = removeWbot as jest.Mock;
const mockedGetIO = getIO as jest.Mock;
const mockedWhatsapp = Whatsapp as unknown as { findByPk: jest.Mock };
const mockedWbotMessageListener = wbotMessageListener as jest.Mock;
const mockedWbotMonitor = wbotMonitor as jest.Mock;

describe("StartWhatsAppSession recovery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetIO.mockReturnValue({ emit: jest.fn() });
    mockedInitWbot.mockResolvedValue({ id: 7 });
  });

  it("removes an existing stale session before starting a WhatsApp session", async () => {
    const whatsapp = {
      id: 7,
      tenantId: 3,
      type: "whatsapp",
      update: jest.fn().mockResolvedValue(undefined)
    };

    await StartWhatsAppSession(whatsapp as any);

    expect(mockedRemoveWbot).toHaveBeenCalledWith(7);
    expect(mockedInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(mockedRemoveWbot.mock.invocationCallOrder[0]).toBeLessThan(
      mockedInitWbot.mock.invocationCallOrder[0]
    );
    expect(mockedWbotMessageListener).toHaveBeenCalledWith({ id: 7 });
    expect(mockedWbotMonitor).toHaveBeenCalledWith({ id: 7 }, whatsapp);
  });

  it("recovers sendSeen failures and removes the stale session before reinitializing", async () => {
    const whatsapp = {
      id: 7,
      tenantId: 3,
      update: jest.fn().mockResolvedValue(undefined)
    };
    mockedWhatsapp.findByPk.mockResolvedValue(whatsapp);

    await StartWhatsAppSessionVerify(
      7,
      new TypeError("Cannot read property 'sendSeen' of undefined")
    );

    expect(mockedWhatsapp.findByPk).toHaveBeenCalledWith(7);
    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(mockedRemoveWbot).toHaveBeenCalledWith(7);
    expect(mockedInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(mockedRemoveWbot.mock.invocationCallOrder[0]).toBeLessThan(
      mockedInitWbot.mock.invocationCallOrder[0]
    );
    expect(mockedWbotMessageListener).toHaveBeenCalledWith({ id: 7 });
    expect(mockedWbotMonitor).toHaveBeenCalledWith({ id: 7 }, whatsapp);
  });
});
