import { getIO } from "../../../libs/socket";
import { initWbot, removeWbot } from "../../../libs/wbot";
import Whatsapp from "../../../models/Whatsapp";
import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { wbotMessageListener } from "../../../services/WbotServices/wbotMessageListener";
import wbotMonitor from "../../../services/WbotServices/wbotMonitor";

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

const mockGetIO = getIO as jest.Mock;
const mockInitWbot = initWbot as jest.Mock;
const mockRemoveWbot = removeWbot as jest.Mock;
const mockFindByPk = Whatsapp.findByPk as jest.Mock;
const mockWbotMessageListener = wbotMessageListener as jest.Mock;
const mockWbotMonitor = wbotMonitor as jest.Mock;

const buildWhatsapp = () =>
  ({
    id: 42,
    tenantId: 7,
    type: "whatsapp",
    update: jest.fn().mockResolvedValue(undefined)
  } as any);

describe("WhatsApp session recovery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetIO.mockReturnValue({ emit: jest.fn() });
    mockRemoveWbot.mockResolvedValue(undefined);
    mockInitWbot.mockResolvedValue({ id: 42 });
  });

  it("recovers sendSeen failures by removing the stale session before reinitializing", async () => {
    const whatsapp = buildWhatsapp();
    mockFindByPk.mockResolvedValue(whatsapp);

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      new TypeError("Cannot read property 'sendSeen' of undefined") as any
    );

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(mockRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(mockRemoveWbot.mock.invocationCallOrder[0]).toBeLessThan(
      mockInitWbot.mock.invocationCallOrder[0]
    );
    expect(mockWbotMessageListener).toHaveBeenCalledWith({ id: 42 });
    expect(mockWbotMonitor).toHaveBeenCalledWith({ id: 42 }, whatsapp);
  });

  it("removes an existing WhatsApp session before opening a replacement session", async () => {
    const whatsapp = buildWhatsapp();

    await StartWhatsAppSession(whatsapp);

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(mockRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(mockRemoveWbot.mock.invocationCallOrder[0]).toBeLessThan(
      mockInitWbot.mock.invocationCallOrder[0]
    );
    expect(mockWbotMessageListener).toHaveBeenCalledWith({ id: 42 });
    expect(mockWbotMonitor).toHaveBeenCalledWith({ id: 42 }, whatsapp);
  });
});
