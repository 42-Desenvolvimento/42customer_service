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

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

const mockedInitWbot = initWbot as jest.MockedFunction<typeof initWbot>;
const mockedRemoveWbot = removeWbot as jest.MockedFunction<typeof removeWbot>;
const mockedGetIO = getIO as jest.MockedFunction<typeof getIO>;
const mockedWhatsappModel = Whatsapp as unknown as {
  findByPk: jest.Mock;
};
const mockedWbotMessageListener = wbotMessageListener as jest.MockedFunction<
  typeof wbotMessageListener
>;
const mockedWbotMonitor = wbotMonitor as jest.MockedFunction<
  typeof wbotMonitor
>;

const makeWhatsapp = (overrides = {}) =>
  ({
    id: 7,
    tenantId: 3,
    type: "whatsapp",
    update: jest.fn().mockResolvedValue(undefined),
    ...overrides
  } as any);

describe("WhatsApp session recovery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetIO.mockReturnValue({ emit: jest.fn() } as any);
    mockedRemoveWbot.mockResolvedValue(undefined);
    mockedInitWbot.mockResolvedValue({ id: 7 } as any);
  });

  it("removes a stale cached session before recovering from sendSeen failures", async () => {
    const whatsapp = makeWhatsapp();
    const wbot = { id: whatsapp.id };
    mockedWhatsappModel.findByPk.mockResolvedValue(whatsapp);
    mockedInitWbot.mockResolvedValue(wbot as any);

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      new TypeError("Cannot read property 'sendSeen' of undefined") as any
    );

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(mockedRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockedInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(mockedRemoveWbot.mock.invocationCallOrder[0]).toBeLessThan(
      mockedInitWbot.mock.invocationCallOrder[0]
    );
    expect(mockedWbotMessageListener).toHaveBeenCalledWith(wbot);
    expect(mockedWbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);
  });

  it("does not restart a session for unrelated errors", async () => {
    await StartWhatsAppSessionVerify(7, "validation failed");

    expect(mockedWhatsappModel.findByPk).not.toHaveBeenCalled();
    expect(mockedRemoveWbot).not.toHaveBeenCalled();
    expect(mockedInitWbot).not.toHaveBeenCalled();
  });

  it("replaces an existing cached client before starting a WhatsApp session", async () => {
    const whatsapp = makeWhatsapp({ id: 11 });
    const wbot = { id: whatsapp.id };
    mockedInitWbot.mockResolvedValue(wbot as any);

    await StartWhatsAppSession(whatsapp);

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(mockedRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockedInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(mockedRemoveWbot.mock.invocationCallOrder[0]).toBeLessThan(
      mockedInitWbot.mock.invocationCallOrder[0]
    );
    expect(mockedWbotMessageListener).toHaveBeenCalledWith(wbot);
    expect(mockedWbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);
  });
});
