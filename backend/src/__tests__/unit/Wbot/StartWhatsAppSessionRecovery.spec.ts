const mockInitWbot = jest.fn();
const mockRemoveWbot = jest.fn();
const mockFindByPk = jest.fn();
const mockEmit = jest.fn();
const mockGetIO = jest.fn();
const mockWbotMessageListener = jest.fn();
const mockWbotMonitor = jest.fn();
const mockLoggerError = jest.fn();
const mockStartInstaBotSession = jest.fn();
const mockStartTbotSession = jest.fn();
const mockStartWaba360 = jest.fn();
const mockStartMessengerBot = jest.fn();

jest.mock("../../../libs/wbot", () => ({
  initWbot: mockInitWbot,
  removeWbot: mockRemoveWbot
}));

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: {
    findByPk: mockFindByPk
  }
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

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: mockLoggerError
  }
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

const {
  StartWhatsAppSessionVerify
} = require("../../../services/WbotServices/StartWhatsAppSessionVerify");
const {
  StartWhatsAppSession
} = require("../../../services/WbotServices/StartWhatsAppSession");

const createWhatsapp = () => ({
  id: 7,
  tenantId: 42,
  type: "whatsapp",
  update: jest.fn().mockResolvedValue(undefined)
});

describe("WhatsApp session recovery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetIO.mockReturnValue({ emit: mockEmit });
    mockInitWbot.mockResolvedValue({ id: 7 });
  });

  it("recovers sendSeen failures by replacing the stale session", async () => {
    const whatsapp = createWhatsapp();
    mockFindByPk.mockResolvedValue(whatsapp);

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      new TypeError("Cannot read property 'sendSeen' of undefined")
    );

    expect(mockFindByPk).toHaveBeenCalledWith(whatsapp.id);
    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(mockEmit).toHaveBeenCalledWith("42:whatsappSession", {
      action: "update",
      session: whatsapp
    });
    expect(mockRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(mockRemoveWbot.mock.invocationCallOrder[0]).toBeLessThan(
      mockInitWbot.mock.invocationCallOrder[0]
    );
    expect(mockWbotMessageListener).toHaveBeenCalledWith({ id: 7 });
    expect(mockWbotMonitor).toHaveBeenCalledWith({ id: 7 }, whatsapp);
  });

  it("replaces an existing WhatsApp client when starting a session", async () => {
    const whatsapp = createWhatsapp();

    await StartWhatsAppSession(whatsapp);

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(mockEmit).toHaveBeenCalledWith("42:whatsappSession", {
      action: "update",
      session: whatsapp
    });
    expect(mockRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(mockRemoveWbot.mock.invocationCallOrder[0]).toBeLessThan(
      mockInitWbot.mock.invocationCallOrder[0]
    );
    expect(mockWbotMessageListener).toHaveBeenCalledWith({ id: 7 });
    expect(mockWbotMonitor).toHaveBeenCalledWith({ id: 7 }, whatsapp);
  });
});
