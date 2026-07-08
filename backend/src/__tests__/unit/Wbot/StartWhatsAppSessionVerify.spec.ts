import { initWbot, removeWbot } from "../../../libs/wbot";
import Whatsapp from "../../../models/Whatsapp";
import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import wbotMonitor from "../../../services/WbotServices/wbotMonitor";
import { wbotMessageListener } from "../../../services/WbotServices/wbotMessageListener";

const emitMock = jest.fn();

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn(() => ({
    emit: emitMock
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
    info: jest.fn()
  }
}));

describe("WhatsApp session restart", () => {
  const mockedInitWbot = initWbot as jest.Mock;
  const mockedRemoveWbot = removeWbot as jest.Mock;
  const mockedFindByPk = Whatsapp.findByPk as jest.Mock;
  const mockedWbotMessageListener = wbotMessageListener as jest.Mock;
  const mockedWbotMonitor = wbotMonitor as jest.Mock;

  const makeWhatsapp = () => ({
    id: 7,
    tenantId: 3,
    name: "main-whatsapp",
    type: "whatsapp",
    status: "CONNECTED",
    update: jest.fn().mockResolvedValue(undefined)
  });

  beforeEach(() => {
    mockedInitWbot.mockResolvedValue({ id: 7 });
  });

  it("removes stale client before reinitializing after sendSeen crashes", async () => {
    const whatsapp = makeWhatsapp();
    mockedFindByPk.mockResolvedValue(whatsapp);

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      "TypeError: Cannot read property 'sendSeen' of undefined"
    );

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(mockedRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockedInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(mockedRemoveWbot.mock.invocationCallOrder[0]).toBeLessThan(
      mockedInitWbot.mock.invocationCallOrder[0]
    );
    expect(mockedWbotMessageListener).toHaveBeenCalledWith({ id: 7 });
    expect(mockedWbotMonitor).toHaveBeenCalledWith({ id: 7 }, whatsapp);
    expect(emitMock).toHaveBeenCalledWith(`${whatsapp.tenantId}:whatsappSession`, {
      action: "update",
      session: whatsapp
    });
  });

  it("removes stale client before starting a whatsapp session", async () => {
    const whatsapp = makeWhatsapp();

    await StartWhatsAppSession(whatsapp as any);

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(mockedRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockedInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(mockedRemoveWbot.mock.invocationCallOrder[0]).toBeLessThan(
      mockedInitWbot.mock.invocationCallOrder[0]
    );
    expect(mockedWbotMessageListener).toHaveBeenCalledWith({ id: 7 });
    expect(mockedWbotMonitor).toHaveBeenCalledWith({ id: 7 }, whatsapp);
  });
});
