import { initWbot, removeWbot } from "../../../libs/wbot";
import Whatsapp from "../../../models/Whatsapp";
import { getIO } from "../../../libs/socket";
import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { wbotMessageListener } from "../../../services/WbotServices/wbotMessageListener";
import wbotMonitor from "../../../services/WbotServices/wbotMonitor";

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

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn()
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

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

const mockedInitWbot = initWbot as jest.Mock;
const mockedRemoveWbot = removeWbot as jest.Mock;
const mockedFindByPk = Whatsapp.findByPk as jest.Mock;
const mockedGetIO = getIO as jest.Mock;
const mockedWbotMessageListener = wbotMessageListener as jest.Mock;
const mockedWbotMonitor = wbotMonitor as jest.Mock;

describe("WhatsApp session recovery", () => {
  const emit = jest.fn();
  const update = jest.fn();
  const wbot = { id: 7 };
  const whatsapp = {
    id: 7,
    tenantId: 3,
    type: "whatsapp",
    update
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetIO.mockReturnValue({ emit });
    mockedInitWbot.mockResolvedValue(wbot);
    mockedFindByPk.mockResolvedValue(whatsapp);
    update.mockResolvedValue(whatsapp);
  });

  it("removes the stale client before recovering from sendSeen session errors", async () => {
    await StartWhatsAppSessionVerify(
      whatsapp.id,
      new TypeError("Cannot read property 'sendSeen' of undefined")
    );

    expect(update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(emit).toHaveBeenCalledWith(`${whatsapp.tenantId}:whatsappSession`, {
      action: "update",
      session: whatsapp
    });
    expect(mockedRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockedInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(mockedRemoveWbot.mock.invocationCallOrder[0]).toBeLessThan(
      mockedInitWbot.mock.invocationCallOrder[0]
    );
    expect(mockedWbotMessageListener).toHaveBeenCalledWith(wbot);
    expect(mockedWbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);
  });

  it("removes the stale client before starting a WhatsApp session", async () => {
    await StartWhatsAppSession(whatsapp as any);

    expect(update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(mockedRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockedInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(mockedRemoveWbot.mock.invocationCallOrder[0]).toBeLessThan(
      mockedInitWbot.mock.invocationCallOrder[0]
    );
  });
});
