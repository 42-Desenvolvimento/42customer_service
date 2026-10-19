const mockFindByPk = jest.fn();
const mockInitWbot = jest.fn();
const mockRemoveWbot = jest.fn();
const mockEmit = jest.fn();
const mockGetIO = jest.fn();
const mockWbotMessageListener = jest.fn();
const mockWbotMonitor = jest.fn();
const mockStartInstaBotSession = jest.fn();
const mockStartTbotSession = jest.fn();
const mockStartWaba360 = jest.fn();
const mockStartMessengerBot = jest.fn();

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: {
    findByPk: mockFindByPk
  }
}));

jest.mock("../../../libs/wbot", () => ({
  initWbot: mockInitWbot,
  removeWbot: mockRemoveWbot
}));

jest.mock("../../../libs/socket", () => ({
  getIO: mockGetIO
}));

jest.mock("../../../services/WbotServices/wbotMessageListener", () => ({
  wbotMessageListener: mockWbotMessageListener
}));

jest.mock("../../../services/WbotServices/wbotMonitor", () => ({
  __esModule: true,
  default: mockWbotMonitor
}));

jest.mock("../../../services/InstagramBotServices/StartInstaBotSession", () => ({
  StartInstaBotSession: mockStartInstaBotSession
}));

jest.mock("../../../services/TbotServices/StartTbotSession", () => ({
  StartTbotSession: mockStartTbotSession
}));

jest.mock("../../../services/WABA360/StartWaba360", () => ({
  StartWaba360: mockStartWaba360
}));

jest.mock("../../../services/MessengerChannelServices/StartMessengerBot", () => ({
  StartMessengerBot: mockStartMessengerBot
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

const makeWhatsapp = () =>
  ({
    id: 42,
    tenantId: 7,
    type: "whatsapp",
    update: jest.fn().mockResolvedValue(undefined)
  } as any);

describe("StartWhatsAppSession recovery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetIO.mockReturnValue({ emit: mockEmit });
    mockRemoveWbot.mockResolvedValue(undefined);
    mockInitWbot.mockResolvedValue({ id: 42 });
  });

  it("removes the stale session before recovering after sendSeen disconnect errors", async () => {
    const whatsapp = makeWhatsapp();
    mockFindByPk.mockResolvedValue(whatsapp);

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      new TypeError("Cannot read property 'sendSeen' of undefined")
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

  it("removes any existing session before starting a new WhatsApp session", async () => {
    const whatsapp = makeWhatsapp();

    await StartWhatsAppSession(whatsapp);

    expect(mockRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(mockRemoveWbot.mock.invocationCallOrder[0]).toBeLessThan(
      mockInitWbot.mock.invocationCallOrder[0]
    );
  });
});
