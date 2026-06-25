const mockFromFilePath = jest.fn();
const mockGetTicketWbot = jest.fn();
const mockCreateUserMessagesLog = jest.fn();
const mockLoggerError = jest.fn();
const mockStartWhatsAppSessionVerify = jest.fn();
const mockUnlinkSync = jest.fn();

jest.mock("whatsapp-web.js", () => ({
  MessageMedia: {
    fromFilePath: mockFromFilePath
  }
}));

jest.mock("../../../helpers/GetTicketWbot", () => mockGetTicketWbot);

jest.mock("../../../models/UserMessagesLog", () => ({
  create: mockCreateUserMessagesLog
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: mockLoggerError
  }
}));

jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: mockStartWhatsAppSessionVerify
}));

jest.mock("fs", () => ({
  unlinkSync: mockUnlinkSync
}));

import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFromFilePath.mockReturnValue({ mimetype: "image/png" });
  });

  const ticket = {
    id: 123,
    whatsappId: 55,
    isGroup: false,
    contact: {
      number: "5511999999999"
    },
    update: jest.fn()
  };

  const media = {
    path: "/tmp/image.png",
    filename: "image.png"
  } as Express.Multer.File;

  it("verifies the WhatsApp session when media sending fails", async () => {
    const sendError = new Error("session disconnected");
    const sendMessage = jest.fn().mockRejectedValue(sendError);
    mockGetTicketWbot.mockResolvedValue({ sendMessage });

    await expect(
      SendWhatsAppMedia({
        media,
        ticket: ticket as never,
        userId: 10
      })
    ).rejects.toMatchObject({
      message: "ERR_SENDING_WAPP_MSG",
      statusCode: 400
    });

    expect(sendMessage).toHaveBeenCalledWith(
      "5511999999999@c.us",
      { mimetype: "image/png" },
      { sendAudioAsVoice: true }
    );
    expect(mockStartWhatsAppSessionVerify).toHaveBeenCalledTimes(1);
    expect(mockStartWhatsAppSessionVerify).toHaveBeenCalledWith(55, sendError);
    expect(ticket.update).not.toHaveBeenCalled();
    expect(mockCreateUserMessagesLog).not.toHaveBeenCalled();
    expect(mockUnlinkSync).not.toHaveBeenCalled();
  });
});
