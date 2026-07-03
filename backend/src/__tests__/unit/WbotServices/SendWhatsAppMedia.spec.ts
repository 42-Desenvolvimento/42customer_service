const mockGetTicketWbot = jest.fn();
const mockFromFilePath = jest.fn();
const mockUnlinkSync = jest.fn();
const mockUserMessagesLogCreate = jest.fn();
const mockLoggerError = jest.fn();
const mockStartWhatsAppSessionVerify = jest.fn();

jest.mock("whatsapp-web.js", () => ({
  MessageMedia: {
    fromFilePath: mockFromFilePath
  }
}));

jest.mock("fs", () => ({
  unlinkSync: mockUnlinkSync
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

import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFromFilePath.mockReturnValue({ mimetype: "image/png", data: "media" });
  });

  it("should verify the whatsapp session before surfacing media send failures", async () => {
    const sendError = new Error("Session closed");
    const sendMessage = jest.fn().mockRejectedValue(sendError);
    const ticket = {
      id: 10,
      whatsappId: 55,
      isGroup: false,
      contact: {
        number: "5511999999999"
      },
      update: jest.fn()
    };
    const media = {
      path: "/tmp/test-media.png",
      filename: "test-media.png"
    } as Express.Multer.File;

    mockGetTicketWbot.mockResolvedValue({ sendMessage });

    await expect(
      SendWhatsAppMedia({ media, ticket: ticket as any, userId: 7 })
    ).rejects.toMatchObject({
      message: "ERR_SENDING_WAPP_MSG",
      statusCode: 400
    });

    expect(sendMessage).toHaveBeenCalledWith(
      "5511999999999@c.us",
      { mimetype: "image/png", data: "media" },
      { sendAudioAsVoice: true }
    );
    expect(mockStartWhatsAppSessionVerify).toHaveBeenCalledWith(
      55,
      sendError
    );
    expect(ticket.update).not.toHaveBeenCalled();
    expect(mockUserMessagesLogCreate).not.toHaveBeenCalled();
    expect(mockUnlinkSync).not.toHaveBeenCalled();
  });
});
