const mockInitWbot = jest.fn();
const mockWhatsappFindByPk = jest.fn();
const mockGetIO = jest.fn();
const mockWbotMessageListener = jest.fn();
const mockWbotMonitor = jest.fn();
const mockLoggerError = jest.fn();

jest.mock("../../../libs/wbot", () => ({
  initWbot: mockInitWbot
}));

jest.mock("../../../models/Whatsapp", () => ({
  findByPk: mockWhatsappFindByPk
}));

jest.mock("../../../libs/socket", () => ({
  getIO: mockGetIO
}));

jest.mock("../../../services/WbotServices/wbotMessageListener", () => ({
  wbotMessageListener: mockWbotMessageListener
}));

jest.mock("../../../services/WbotServices/wbotMonitor", () => mockWbotMonitor);

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: mockLoggerError
  }
}));

import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

describe("StartWhatsAppSessionVerify", () => {
  const mockEmit = jest.fn();

  const buildWhatsapp = () => ({
    id: 7,
    tenantId: 42,
    update: jest.fn()
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetIO.mockReturnValue({ emit: mockEmit });
    mockInitWbot.mockResolvedValue({ id: "wbot-session" });
  });

  it.each([
    ["session closed", "Session closed unexpectedly"],
    ["wapp not initialized", new Error("ERR_WAPP_NOT_INITIALIZED")],
    [
      "sendSeen TypeError",
      new TypeError("Cannot read property 'sendSeen' of undefined")
    ]
  ])("restarts whatsapp session when error is %s", async (_case, error) => {
    const whatsapp = buildWhatsapp();
    mockWhatsappFindByPk.mockResolvedValue(whatsapp);

    await StartWhatsAppSessionVerify(whatsapp.id, error as unknown as string);

    expect(mockWhatsappFindByPk).toHaveBeenCalledWith(whatsapp.id);
    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(mockEmit).toHaveBeenCalledWith("42:whatsappSession", {
      action: "update",
      session: whatsapp
    });
    expect(mockInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(mockWbotMessageListener).toHaveBeenCalledWith({ id: "wbot-session" });
    expect(mockWbotMonitor).toHaveBeenCalledWith(
      { id: "wbot-session" },
      whatsapp
    );
  });

  it("does not restart whatsapp session for unrelated send errors", async () => {
    await StartWhatsAppSessionVerify(7, "media upload timeout");

    expect(mockWhatsappFindByPk).not.toHaveBeenCalled();
    expect(mockInitWbot).not.toHaveBeenCalled();
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("logs initialization failures without throwing", async () => {
    const whatsapp = buildWhatsapp();
    const initError = new Error("init failed");
    mockWhatsappFindByPk.mockResolvedValue(whatsapp);
    mockInitWbot.mockRejectedValue(initError);

    await expect(
      StartWhatsAppSessionVerify(whatsapp.id, "session closed")
    ).resolves.toBeUndefined();

    expect(mockLoggerError).toHaveBeenCalledWith(initError);
  });
});

export {};
