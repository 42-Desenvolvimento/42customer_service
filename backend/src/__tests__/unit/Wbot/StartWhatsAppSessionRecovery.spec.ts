import Whatsapp from "../../../models/Whatsapp";
import { initWbot, removeWbot } from "../../../libs/wbot";
import { getIO } from "../../../libs/socket";
import { wbotMessageListener } from "../../../services/WbotServices/wbotMessageListener";
import wbotMonitor from "../../../services/WbotServices/wbotMonitor";
import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: {
    findByPk: jest.fn()
  }
}));

jest.mock("../../../libs/wbot", () => ({
  initWbot: jest.fn(),
  removeWbot: jest.fn()
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

const mockedWhatsapp = Whatsapp as unknown as {
  findByPk: jest.Mock;
};
const mockedInitWbot = initWbot as jest.Mock;
const mockedRemoveWbot = removeWbot as jest.Mock;
const mockedGetIO = getIO as jest.Mock;
const mockedWbotMessageListener = wbotMessageListener as jest.Mock;
const mockedWbotMonitor = wbotMonitor as jest.Mock;

const buildWhatsapp = () =>
  ({
    id: 42,
    tenantId: 7,
    name: "Principal",
    type: "whatsapp",
    status: "CONNECTED",
    update: jest.fn().mockResolvedValue(undefined)
  } as any);

let wbot: { id: number; on: jest.Mock };

describe("WhatsApp session recovery", () => {
  beforeEach(() => {
    wbot = { id: 42, on: jest.fn() };
    mockedGetIO.mockReturnValue({ emit: jest.fn() });
    mockedInitWbot.mockResolvedValue(wbot);
  });

  it("removes stale session before recovering from a closed WhatsApp session", async () => {
    const whatsapp = buildWhatsapp();
    mockedWhatsapp.findByPk.mockResolvedValue(whatsapp);

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      new Error("Protocol error: Session closed")
    );

    expect(mockedRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockedInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(
      mockedRemoveWbot.mock.invocationCallOrder[0]
    ).toBeLessThan(mockedInitWbot.mock.invocationCallOrder[0]);
    expect(mockedWbotMessageListener).toHaveBeenCalledWith(wbot);
    expect(mockedWbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);
  });

  it("recognizes sendSeen TypeError as a recoverable disconnected session", async () => {
    const whatsapp = buildWhatsapp();
    mockedWhatsapp.findByPk.mockResolvedValue(whatsapp);

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      "TypeError: Cannot read property 'sendSeen' of undefined"
    );

    expect(mockedRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockedInitWbot).toHaveBeenCalledWith(whatsapp);
  });

  it("removes stale session before starting a WhatsApp session", async () => {
    const whatsapp = buildWhatsapp();

    await StartWhatsAppSession(whatsapp);

    expect(mockedRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockedInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(
      mockedRemoveWbot.mock.invocationCallOrder[0]
    ).toBeLessThan(mockedInitWbot.mock.invocationCallOrder[0]);
  });
});
