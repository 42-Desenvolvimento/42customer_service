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

import { getIO } from "../../../libs/socket";
import { initWbot, removeWbot } from "../../../libs/wbot";
import Whatsapp from "../../../models/Whatsapp";
import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { wbotMessageListener } from "../../../services/WbotServices/wbotMessageListener";
import wbotMonitor from "../../../services/WbotServices/wbotMonitor";

const mockedGetIO = getIO as jest.Mock;
const mockedInitWbot = initWbot as jest.MockedFunction<typeof initWbot>;
const mockedRemoveWbot = removeWbot as jest.MockedFunction<typeof removeWbot>;
const mockedFindWhatsapp = Whatsapp.findByPk as jest.Mock;
const mockedMessageListener = wbotMessageListener as jest.Mock;
const mockedMonitor = wbotMonitor as jest.Mock;

const makeWhatsapp = () => ({
  id: 7,
  tenantId: 2,
  type: "whatsapp",
  update: jest.fn().mockResolvedValue(undefined)
});

describe("WhatsApp session recovery", () => {
  let callOrder: string[];
  const wbot = { id: 7 };

  beforeEach(() => {
    callOrder = [];

    mockedGetIO.mockReturnValue({ emit: jest.fn() });
    mockedRemoveWbot.mockImplementation(async () => {
      callOrder.push("remove");
    });
    mockedInitWbot.mockImplementation(async () => {
      callOrder.push("init");
      return wbot as any;
    });
  });

  it("removes the stale session before recovering from a closed session error", async () => {
    const whatsapp = makeWhatsapp();
    mockedFindWhatsapp.mockResolvedValue(whatsapp);

    await StartWhatsAppSessionVerify(whatsapp.id, "Session closed");

    expect(mockedRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockedInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(callOrder).toEqual(["remove", "init"]);
    expect(mockedMessageListener).toHaveBeenCalledWith(wbot);
    expect(mockedMonitor).toHaveBeenCalledWith(wbot, whatsapp);
  });

  it("recognizes sendSeen disconnect errors case-insensitively", async () => {
    const whatsapp = makeWhatsapp();
    mockedFindWhatsapp.mockResolvedValue(whatsapp);

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      "TypeError: Cannot read property 'sendSeen' of undefined"
    );

    expect(mockedRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockedInitWbot).toHaveBeenCalledWith(whatsapp);
  });

  it("removes the stale session before starting a manual WhatsApp session", async () => {
    const whatsapp = makeWhatsapp();

    await StartWhatsAppSession(whatsapp as any);

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(mockedRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockedInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(callOrder).toEqual(["remove", "init"]);
  });
});
