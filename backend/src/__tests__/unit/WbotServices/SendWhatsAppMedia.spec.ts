const mockFromFilePath = jest.fn();
const mockGetTicketWbot = jest.fn();
const mockUserMessagesLogCreate = jest.fn();
const mockLoggerError = jest.fn();
const mockStartWhatsAppSessionVerify = jest.fn();
const mockUnlinkSync = jest.fn();

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
  });

  it("deve verificar a sessão do WhatsApp quando o envio de mídia falhar", async () => {
    const sendError = new Error("session closed");
    const mockSendMessage = jest.fn().mockRejectedValue(sendError);
    const mediaPayload = { mimetype: "application/pdf" };

    mockFromFilePath.mockReturnValue(mediaPayload);
    mockGetTicketWbot.mockResolvedValue({
      sendMessage: mockSendMessage
    });

    const ticket = {
      id: 10,
      whatsappId: 4,
      isGroup: true,
      contact: {
        number: "5511888888888"
      },
      update: jest.fn()
    };
    const media = {
      path: "/tmp/invoice.pdf",
      filename: "invoice.pdf"
    };

    await expect(
      SendWhatsAppMedia({
        media: media as any,
        ticket: ticket as any,
        userId: 21
      })
    ).rejects.toMatchObject({
      message: "ERR_SENDING_WAPP_MSG",
      statusCode: 400
    });

    expect(mockFromFilePath).toHaveBeenCalledWith(media.path);
    expect(mockSendMessage).toHaveBeenCalledWith(
      "5511888888888@g.us",
      mediaPayload,
      { sendAudioAsVoice: true }
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
