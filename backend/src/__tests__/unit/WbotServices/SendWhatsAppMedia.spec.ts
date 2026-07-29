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

import AppError from "../../../errors/AppError";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("verifies the WhatsApp session and raises a stable AppError when media sending fails", async () => {
    const sendError = new Error("send failed");
    const media = {
      path: "/tmp/audio.ogg",
      filename: "audio.ogg"
    } as Express.Multer.File;
    const ticket = {
      id: 12,
      whatsappId: 8,
      isGroup: true,
      contact: {
        number: "5511888888888"
      },
      update: jest.fn()
    } as any;
    const mediaPayload = { mimetype: "audio/ogg" };
    const mockSendMessage = jest.fn().mockRejectedValue(sendError);

    mockFromFilePath.mockReturnValue(mediaPayload);
    mockGetTicketWbot.mockResolvedValue({
      sendMessage: mockSendMessage
    });

    await expect(
      SendWhatsAppMedia({
        media,
        ticket,
        userId: 42
      })
    ).rejects.toBeInstanceOf(AppError);

    expect(mockFromFilePath).toHaveBeenCalledWith(media.path);
    expect(mockSendMessage).toHaveBeenCalledWith(
      "5511888888888@g.us",
      mediaPayload,
      { sendAudioAsVoice: true }
    );
    expect(mockLoggerError).toHaveBeenCalledWith(
      `SendWhatsAppMedia | Error: ${sendError}`
    );
    expect(mockStartWhatsAppSessionVerify).toHaveBeenCalledWith(
      ticket.whatsappId,
      sendError
    );
    expect(ticket.update).not.toHaveBeenCalled();
    expect(mockUserMessagesLogCreate).not.toHaveBeenCalled();
    expect(mockUnlinkSync).not.toHaveBeenCalled();
  });
});
