const mockUnlinkSync = jest.fn();
const mockMessageMediaFromFilePath = jest.fn();
const mockGetTicketWbot = jest.fn();
const mockUserMessagesLogCreate = jest.fn();
const mockLoggerError = jest.fn();
const mockStartWhatsAppSessionVerify = jest.fn();

jest.mock("fs", () => ({
  unlinkSync: (...args: unknown[]) => mockUnlinkSync(...args)
}));

jest.mock("whatsapp-web.js", () => ({
  MessageMedia: {
    fromFilePath: (...args: unknown[]) => mockMessageMediaFromFilePath(...args)
  }
}));

jest.mock("../../../helpers/GetTicketWbot", () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockGetTicketWbot(...args)
}));

jest.mock("../../../models/UserMessagesLog", () => ({
  __esModule: true,
  default: {
    create: (...args: unknown[]) => mockUserMessagesLogCreate(...args)
  }
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args)
  }
}));

jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: (...args: unknown[]) =>
    mockStartWhatsAppSessionVerify(...args)
}));

import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMessageMediaFromFilePath.mockReturnValue({
      mimetype: "image/png",
      data: "encoded"
    });
  });

  it("starts whatsapp session verification when media sending fails", async () => {
    const sendError = new Error("session closed");
    const mockSendMessage = jest.fn().mockRejectedValue(sendError);
    mockGetTicketWbot.mockResolvedValue({
      sendMessage: mockSendMessage
    });

    const ticket = {
      id: 456,
      whatsappId: 88,
      isGroup: true,
      contact: {
        number: "5511888888888"
      },
      update: jest.fn().mockResolvedValue(undefined)
    };
    const media = {
      path: "/tmp/image.png",
      filename: "image.png"
    };

    await expect(
      SendWhatsAppMedia({
        media: media as Express.Multer.File,
        ticket: ticket as any,
        userId: 99
      })
    ).rejects.toMatchObject({
      message: "ERR_SENDING_WAPP_MSG",
      statusCode: 400
    });

    expect(mockGetTicketWbot).toHaveBeenCalledWith(ticket);
    expect(mockMessageMediaFromFilePath).toHaveBeenCalledWith("/tmp/image.png");
    expect(mockSendMessage).toHaveBeenCalledWith(
      "5511888888888@g.us",
      {
        mimetype: "image/png",
        data: "encoded"
      },
      { sendAudioAsVoice: true }
    );
    expect(mockLoggerError).toHaveBeenCalledWith(
      `SendWhatsAppMedia | Error: ${sendError}`
    );
    expect(mockStartWhatsAppSessionVerify).toHaveBeenCalledWith(88, sendError);
    expect(ticket.update).not.toHaveBeenCalled();
    expect(mockUserMessagesLogCreate).not.toHaveBeenCalled();
    expect(mockUnlinkSync).not.toHaveBeenCalled();
  });
});
