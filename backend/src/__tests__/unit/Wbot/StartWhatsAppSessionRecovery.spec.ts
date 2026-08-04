import { getIO } from "../../../libs/socket";
import { initWbot, removeWbot } from "../../../libs/wbot";
import Whatsapp from "../../../models/Whatsapp";
import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

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

const mockedGetIO = getIO as jest.Mock;
const mockedInitWbot = initWbot as jest.Mock;
const mockedRemoveWbot = removeWbot as jest.Mock;
const mockedFindByPk = Whatsapp.findByPk as jest.Mock;

const buildWhatsapp = () =>
  ({
    id: 7,
    name: "main-whatsapp",
    tenantId: 3,
    type: "whatsapp",
    update: jest.fn().mockResolvedValue(undefined)
  } as any);

const expectRemoveBeforeInit = () => {
  const removeOrder = mockedRemoveWbot.mock.invocationCallOrder[0];
  const initOrder = mockedInitWbot.mock.invocationCallOrder[0];

  expect(removeOrder).toBeLessThan(initOrder);
};

describe("WhatsApp session recovery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetIO.mockReturnValue({ emit: jest.fn() });
    mockedInitWbot.mockResolvedValue({ id: 7 });
  });

  it("replaces the stale client before recovering from sendSeen failures", async () => {
    const whatsapp = buildWhatsapp();
    mockedFindByPk.mockResolvedValue(whatsapp);

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      new TypeError("Cannot read property 'sendSeen' of undefined")
    );

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(mockedRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockedInitWbot).toHaveBeenCalledWith(whatsapp);
    expectRemoveBeforeInit();
  });

  it("does not restart the session for unrelated errors", async () => {
    await StartWhatsAppSessionVerify(7, "temporary network timeout");

    expect(mockedFindByPk).not.toHaveBeenCalled();
    expect(mockedRemoveWbot).not.toHaveBeenCalled();
    expect(mockedInitWbot).not.toHaveBeenCalled();
  });

  it("replaces the stale client before explicitly starting whatsapp sessions", async () => {
    const whatsapp = buildWhatsapp();

    await StartWhatsAppSession(whatsapp);

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(mockedRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockedInitWbot).toHaveBeenCalledWith(whatsapp);
    expectRemoveBeforeInit();
  });
});
