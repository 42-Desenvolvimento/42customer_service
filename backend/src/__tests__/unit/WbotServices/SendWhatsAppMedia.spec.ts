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
    create: mockCreateUserMessagesLog
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

import AppError from "../../../errors/AppError";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("aciona a verificacao da sessao e retorna erro controlado quando o envio falha", async () => {
    const sendError = new Error("client disconnected");
    const media = {
      filename: "audio.ogg",
      path: "/tmp/audio.ogg"
    } as Express.Multer.File;
    const ticket = {
      id: 10,
      whatsappId: 77,
      isGroup: false,
      contact: {
        number: "5511999999999"
      },
      update: jest.fn()
    } as any;

    mockFromFilePath.mockReturnValue({ mimetype: "audio/ogg" });
    mockGetTicketWbot.mockResolvedValue({
      sendMessage: jest.fn().mockRejectedValue(sendError)
    });

    await expect(
      SendWhatsAppMedia({ media, ticket, userId: 123 })
    ).rejects.toMatchObject(new AppError("ERR_SENDING_WAPP_MSG"));

    expect(mockStartWhatsAppSessionVerify).toHaveBeenCalledWith(
      ticket.whatsappId,
      sendError
    );
    expect(mockLoggerError).toHaveBeenCalledWith(
      `SendWhatsAppMedia | Error: ${sendError}`
    );
    expect(mockCreateUserMessagesLog).not.toHaveBeenCalled();
    expect(mockUnlinkSync).not.toHaveBeenCalled();
  });
});
