const mockInitWbot = jest.fn();
const mockRemoveWbot = jest.fn();
const mockFindByPk = jest.fn();
const mockGetIO = jest.fn();
const mockWbotMessageListener = jest.fn();
const mockWbotMonitor = jest.fn();
const mockLoggerError = jest.fn();

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

import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

describe("StartWhatsAppSessionVerify", () => {
  const emit = jest.fn();
  const whatsapp = {
    id: 42,
    tenantId: 7,
    update: jest.fn()
  };
  const wbot = { id: 42 };

  beforeEach(() => {
    jest.clearAllMocks();

    mockFindByPk.mockResolvedValue(whatsapp);
    mockGetIO.mockReturnValue({ emit });
    mockInitWbot.mockResolvedValue(wbot);
  });

  it("removes the cached session before starting a recovered session", async () => {
    await StartWhatsAppSessionVerify(
      whatsapp.id,
      new Error("Protocol error (Runtime.callFunctionOn): Session closed.")
    );

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(emit).toHaveBeenCalledWith(`${whatsapp.tenantId}:whatsappSession`, {
      action: "update",
      session: whatsapp
    });
    expect(mockRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(mockRemoveWbot.mock.invocationCallOrder[0]).toBeLessThan(
      mockInitWbot.mock.invocationCallOrder[0]
    );
    expect(mockWbotMessageListener).toHaveBeenCalledWith(wbot);
    expect(mockWbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);
  });

  it("recovers when sendSeen fails because the client is disconnected", async () => {
    await StartWhatsAppSessionVerify(
      whatsapp.id,
      "TypeError: Cannot read property 'sendSeen' of undefined"
    );

    expect(mockRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockInitWbot).toHaveBeenCalledWith(whatsapp);
  });
});
