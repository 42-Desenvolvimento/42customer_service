const mockGetTicketWbot = jest.fn();
const mockFromFilePath = jest.fn();
const mockUserMessagesLogCreate = jest.fn();
const mockUnlinkSync = jest.fn();
const mockStartWhatsAppSessionVerify = jest.fn();
const mockLogger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
};

jest.mock("fs", () => ({
  __esModule: true,
  default: {
    unlinkSync: mockUnlinkSync
  },
  unlinkSync: mockUnlinkSync
}));

jest.mock("whatsapp-web.js", () => ({
  MessageMedia: {
    fromFilePath: mockFromFilePath
  }
}));

jest.mock("../../../helpers/GetTicketWbot", () => ({
  __esModule: true,
  default: mockGetTicketWbot
}));

jest.mock("../../../models/UserMessagesLog", () => ({
  __esModule: true,
  default: {
    create: mockUserMessagesLogCreate
  }
}));

jest.mock("../../../utils/logger", () => ({
  logger: mockLogger
}));

jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: mockStartWhatsAppSessionVerify
}));

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("verifies the WhatsApp session when media sending fails", async () => {
    const SendWhatsAppMedia = require("../../../services/WbotServices/SendWhatsAppMedia")
      .default;
    const mediaPayload = { mimetype: "image/png" };
    const sendError = new Error("session closed");
    const sendMessage = jest.fn().mockRejectedValue(sendError);
    const ticket = {
      id: 123,
      whatsappId: 45,
      isGroup: false,
      contact: {
        number: "5511999999999"
      },
      update: jest.fn()
    };
    const media = {
      path: "/tmp/upload.png",
      filename: "upload.png"
    };

    mockGetTicketWbot.mockResolvedValue({ sendMessage });
    mockFromFilePath.mockReturnValue(mediaPayload);

    await expect(
      SendWhatsAppMedia({
        media,
        ticket,
        userId: 9
      })
    ).rejects.toMatchObject({
      message: "ERR_SENDING_WAPP_MSG",
      statusCode: 400
    });

    expect(sendMessage).toHaveBeenCalledWith(
      "5511999999999@c.us",
      mediaPayload,
      { sendAudioAsVoice: true }
    );
    expect(mockStartWhatsAppSessionVerify).toHaveBeenCalledWith(
      45,
      sendError
    );
    expect(mockUserMessagesLogCreate).not.toHaveBeenCalled();
    expect(mockUnlinkSync).not.toHaveBeenCalled();
  });
});

export {};
