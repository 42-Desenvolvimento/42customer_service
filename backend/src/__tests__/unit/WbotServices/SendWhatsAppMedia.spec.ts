const mockGetTicketWbot = jest.fn();
const mockFromFilePath = jest.fn();
const mockUserMessagesLogCreate = jest.fn();
const mockLoggerError = jest.fn();
const mockStartWhatsAppSessionVerify = jest.fn();
const mockUnlinkSync = jest.fn();

jest.mock("../../../helpers/GetTicketWbot", () => ({
  __esModule: true,
  default: mockGetTicketWbot
}));

jest.mock("whatsapp-web.js", () => ({
  MessageMedia: {
    fromFilePath: mockFromFilePath
  }
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

import AppError from "../../../errors/AppError";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("verifies the WhatsApp session before wrapping send failures", async () => {
    const sendError = new Error("Session closed");
    const sendMessage = jest.fn().mockRejectedValue(sendError);
    mockGetTicketWbot.mockResolvedValue({ sendMessage });
    mockFromFilePath.mockReturnValue({ mimetype: "image/png" });
    const ticket = {
      id: 12,
      whatsappId: 99,
      isGroup: false,
      contact: {
        number: "5511999999999"
      },
      update: jest.fn()
    };

    await expect(
      SendWhatsAppMedia({
        media: {
          path: "/tmp/media.png",
          filename: "media.png"
        } as Express.Multer.File,
        ticket: ticket as any,
        userId: 3
      })
    ).rejects.toMatchObject<AppError>({
      message: "ERR_SENDING_WAPP_MSG",
      statusCode: 400
    });

    expect(sendMessage).toHaveBeenCalledWith(
      "5511999999999@c.us",
      { mimetype: "image/png" },
      { sendAudioAsVoice: true }
    );
    expect(mockStartWhatsAppSessionVerify).toHaveBeenCalledTimes(1);
    expect(mockStartWhatsAppSessionVerify).toHaveBeenCalledWith(99, sendError);
    expect(ticket.update).not.toHaveBeenCalled();
    expect(mockUserMessagesLogCreate).not.toHaveBeenCalled();
    expect(mockUnlinkSync).not.toHaveBeenCalled();
  });
});
