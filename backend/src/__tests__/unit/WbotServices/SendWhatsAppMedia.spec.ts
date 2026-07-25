const mockUnlinkSync = jest.fn();
const mockFromFilePath = jest.fn();
const mockGetTicketWbot = jest.fn();
const mockUserMessagesLogCreate = jest.fn();
const mockLoggerError = jest.fn();
const mockStartWhatsAppSessionVerify = jest.fn();

jest.mock("fs", () => ({
  unlinkSync: mockUnlinkSync
}));

jest.mock("whatsapp-web.js", () => ({
  MessageMedia: {
    fromFilePath: mockFromFilePath
  }
}));

jest.mock("../../../helpers/GetTicketWbot", () => mockGetTicketWbot);

jest.mock("../../../models/UserMessagesLog", () => ({
  create: mockUserMessagesLogCreate
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: mockLoggerError
  }
}));

jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: mockStartWhatsAppSessionVerify
}));

import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFromFilePath.mockReturnValue({ mimetype: "audio/ogg" });
  });

  it("should verify the WhatsApp session and raise AppError when media send fails", async () => {
    const sendError = new Error("Session closed");
    const sendMessage = jest.fn().mockRejectedValue(sendError);
    const ticketUpdate = jest.fn();
    const ticket = {
      id: 123,
      whatsappId: 45,
      isGroup: false,
      contact: {
        number: "5511999999999"
      },
      update: ticketUpdate
    } as any;
    const media = {
      path: "/tmp/media.ogg",
      filename: "media.ogg"
    } as Express.Multer.File;

    mockGetTicketWbot.mockResolvedValue({ sendMessage });

    await expect(
      SendWhatsAppMedia({ media, ticket, userId: 77 })
    ).rejects.toMatchObject({
      message: "ERR_SENDING_WAPP_MSG",
      statusCode: 400
    });

    expect(mockFromFilePath).toHaveBeenCalledWith("/tmp/media.ogg");
    expect(sendMessage).toHaveBeenCalledWith(
      "5511999999999@c.us",
      { mimetype: "audio/ogg" },
      { sendAudioAsVoice: true }
    );
    expect(mockStartWhatsAppSessionVerify).toHaveBeenCalledWith(45, sendError);
    expect(ticketUpdate).not.toHaveBeenCalled();
    expect(mockUserMessagesLogCreate).not.toHaveBeenCalled();
    expect(mockUnlinkSync).not.toHaveBeenCalled();
  });

  it("should send group media, update the ticket and log the user message", async () => {
    const sentMessage = { id: { id: "message-id" } };
    const sendMessage = jest.fn().mockResolvedValue(sentMessage);
    const ticketUpdate = jest.fn();
    const ticket = {
      id: 321,
      whatsappId: 54,
      isGroup: true,
      contact: {
        number: "120363000000000000"
      },
      update: ticketUpdate
    } as any;
    const media = {
      path: "/tmp/group-image.png",
      filename: "group-image.png"
    } as Express.Multer.File;

    mockGetTicketWbot.mockResolvedValue({ sendMessage });

    await expect(
      SendWhatsAppMedia({ media, ticket, userId: 88 })
    ).resolves.toBe(sentMessage);

    expect(sendMessage).toHaveBeenCalledWith(
      "120363000000000000@g.us",
      { mimetype: "audio/ogg" },
      { sendAudioAsVoice: true }
    );
    expect(ticketUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        lastMessage: "group-image.png",
        lastMessageAt: expect.any(Number)
      })
    );
    expect(mockUserMessagesLogCreate).toHaveBeenCalledWith({
      messageId: "message-id",
      userId: 88,
      ticketId: 321
    });
    expect(mockUnlinkSync).toHaveBeenCalledWith("/tmp/group-image.png");
    expect(mockStartWhatsAppSessionVerify).not.toHaveBeenCalled();
  });
});

export {};
