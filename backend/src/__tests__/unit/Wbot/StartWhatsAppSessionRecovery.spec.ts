import { initWbot, removeWbot } from "../../../libs/wbot";
import Whatsapp from "../../../models/Whatsapp";
import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import wbotMonitor from "../../../services/WbotServices/wbotMonitor";
import { wbotMessageListener } from "../../../services/WbotServices/wbotMessageListener";

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn(() => ({
    emit: jest.fn()
  }))
}));

jest.mock("../../../libs/wbot", () => ({
  initWbot: jest.fn(),
  removeWbot: jest.fn()
}));

jest.mock("../../../models/Whatsapp", () => ({
  findByPk: jest.fn()
}));

jest.mock("../../../services/WbotServices/wbotMessageListener", () => ({
  wbotMessageListener: jest.fn()
}));

jest.mock("../../../services/WbotServices/wbotMonitor", () => jest.fn());

jest.mock("../../../services/TbotServices/StartTbotSession", () => ({
  StartTbotSession: jest.fn()
}));

jest.mock("../../../services/InstagramBotServices/StartInstaBotSession", () => ({
  StartInstaBotSession: jest.fn()
}));

jest.mock("../../../services/WABA360/StartWaba360", () => ({
  StartWaba360: jest.fn()
}));

jest.mock("../../../services/MessengerChannelServices/StartMessengerBot", () => ({
  StartMessengerBot: jest.fn()
}));

const mockedInitWbot = initWbot as jest.Mock;
const mockedRemoveWbot = removeWbot as jest.Mock;
const mockedWhatsapp = Whatsapp as unknown as { findByPk: jest.Mock };
const mockedWbotMessageListener = wbotMessageListener as jest.Mock;
const mockedWbotMonitor = wbotMonitor as jest.Mock;

const makeWhatsapp = () =>
  ({
    id: 42,
    tenantId: 7,
    name: "Main WhatsApp",
    type: "whatsapp",
    status: "CONNECTED",
    update: jest.fn().mockResolvedValue(undefined)
  } as any);

describe("WhatsApp session recovery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedInitWbot.mockResolvedValue({ id: 42 });
  });

  it("removes the stale client before verifying and recreating a failed session", async () => {
    const whatsapp = makeWhatsapp();
    mockedWhatsapp.findByPk.mockResolvedValue(whatsapp);

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      new Error("TypeError: Cannot read property 'sendSeen' of undefined")
    );

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(mockedRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockedInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(mockedRemoveWbot.mock.invocationCallOrder[0]).toBeLessThan(
      mockedInitWbot.mock.invocationCallOrder[0]
    );
    expect(mockedWbotMessageListener).toHaveBeenCalledWith({ id: 42 });
    expect(mockedWbotMonitor).toHaveBeenCalledWith({ id: 42 }, whatsapp);
  });

  it("removes the stale client before directly starting a whatsapp session", async () => {
    const whatsapp = makeWhatsapp();

    await StartWhatsAppSession(whatsapp);

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(mockedRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockedInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(mockedRemoveWbot.mock.invocationCallOrder[0]).toBeLessThan(
      mockedInitWbot.mock.invocationCallOrder[0]
    );
  });
});
