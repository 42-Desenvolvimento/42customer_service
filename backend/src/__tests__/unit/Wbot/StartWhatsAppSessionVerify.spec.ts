import Whatsapp from "../../../models/Whatsapp";
import { initWbot, removeWbot } from "../../../libs/wbot";
import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

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
  getIO: jest.fn(() => ({
    emit: jest.fn()
  }))
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

describe("WhatsApp session recovery", () => {
  const mockedWhatsappModel = Whatsapp as jest.Mocked<typeof Whatsapp>;
  const mockedInitWbot = initWbot as jest.Mock;
  const mockedRemoveWbot = removeWbot as jest.Mock;

  const createWhatsapp = () =>
    ({
      id: 123,
      name: "Principal",
      tenantId: 7,
      type: "whatsapp",
      update: jest.fn()
    } as any);

  beforeEach(() => {
    mockedInitWbot.mockResolvedValue({
      on: jest.fn()
    });
  });

  it("removes a stale session before reconnecting after sendSeen failures", async () => {
    const whatsapp = createWhatsapp();
    const callOrder: string[] = [];

    mockedWhatsappModel.findByPk.mockResolvedValue(whatsapp);
    mockedRemoveWbot.mockImplementation(() => callOrder.push("remove"));
    mockedInitWbot.mockImplementation(async () => {
      callOrder.push("init");
      return { on: jest.fn() };
    });

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      "TypeError: Cannot read property 'sendSeen' of undefined"
    );

    expect(mockedRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockedInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(callOrder).toEqual(["remove", "init"]);
  });

  it("removes a stale session before starting a whatsapp session", async () => {
    const whatsapp = createWhatsapp();
    const callOrder: string[] = [];

    mockedRemoveWbot.mockImplementation(() => callOrder.push("remove"));
    mockedInitWbot.mockImplementation(async () => {
      callOrder.push("init");
      return { on: jest.fn() };
    });

    await StartWhatsAppSession(whatsapp);

    expect(mockedRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockedInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(callOrder).toEqual(["remove", "init"]);
  });
});
