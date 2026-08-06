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
  });

  it("should verify whatsapp session when media sending fails", async () => {
    const sendError = new Error("ERR_WAPP_NOT_INITIALIZED");
    const media = {
      path: "/tmp/audio.ogg",
      filename: "audio.ogg"
    };
    const ticket = {
      id: 321,
      whatsappId: 77,
      isGroup: true,
      contact: {
        number: "5511888888888"
      },
      update: jest.fn().mockResolvedValue(undefined)
    };
    const sendMessage = jest.fn().mockRejectedValue(sendError);

    mockFromFilePath.mockReturnValue({ mimetype: "audio/ogg" });
    mockGetTicketWbot.mockResolvedValue({ sendMessage });

    await expect(
      SendWhatsAppMedia({
        media: media as Express.Multer.File,
        ticket: ticket as any,
        userId: 45
      })
    ).rejects.toMatchObject({
      message: "ERR_SENDING_WAPP_MSG"
    });

    expect(mockFromFilePath).toHaveBeenCalledWith(media.path);
    expect(sendMessage).toHaveBeenCalledWith(
      "5511888888888@g.us",
      { mimetype: "audio/ogg" },
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
