const mockFromFilePath = jest.fn();
const mockUnlinkSync = jest.fn();
const mockGetTicketWbot = jest.fn();
const mockUserMessagesLogCreate = jest.fn();
const mockLoggerError = jest.fn();
const mockStartWhatsAppSessionVerify = jest.fn();

jest.mock("fs", () => ({
  __esModule: true,
  default: {
    unlinkSync: mockUnlinkSync
  }
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
  const media = {
    path: "/tmp/audio.ogg",
    filename: "audio.ogg"
  } as Express.Multer.File;

  const buildTicket = (overrides = {}) =>
    ({
      id: 123,
      whatsappId: 456,
      isGroup: false,
      contact: {
        number: "559999999999"
      },
      update: jest.fn(),
      ...overrides
    } as any);

  beforeEach(() => {
    jest.clearAllMocks();
    mockFromFilePath.mockReturnValue({ mimetype: "audio/ogg" });
  });

  it("envia a mídia, atualiza o ticket, registra o usuário e remove o arquivo temporário", async () => {
    const sendMessage = {
      id: {
        id: "message-id"
      }
    };
    const sendMessageMock = jest.fn().mockResolvedValue(sendMessage);
    const ticket = buildTicket();

    mockGetTicketWbot.mockResolvedValue({
      sendMessage: sendMessageMock
    });

    await expect(
      SendWhatsAppMedia({ media, ticket, userId: 77 })
    ).resolves.toBe(sendMessage);

    expect(mockFromFilePath).toHaveBeenCalledWith(media.path);
    expect(sendMessageMock).toHaveBeenCalledWith(
      "559999999999@c.us",
      { mimetype: "audio/ogg" },
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: media.filename,
      lastMessageAt: expect.any(Number)
    });
    expect(mockUserMessagesLogCreate).toHaveBeenCalledWith({
      messageId: "message-id",
      userId: 77,
      ticketId: 123
    });
    expect(mockUnlinkSync).toHaveBeenCalledWith(media.path);
    expect(mockStartWhatsAppSessionVerify).not.toHaveBeenCalled();
  });

  it("revalida a sessão do WhatsApp e normaliza erro quando o envio falha", async () => {
    const ticket = buildTicket();
    const error = new Error("send failed");

    mockGetTicketWbot.mockResolvedValue({
      sendMessage: jest.fn().mockRejectedValue(error)
    });

    await expect(
      SendWhatsAppMedia({ media, ticket, userId: 77 })
    ).rejects.toBeInstanceOf(AppError);

    expect(mockStartWhatsAppSessionVerify).toHaveBeenCalledWith(
      ticket.whatsappId,
      error
    );
    expect(mockUnlinkSync).not.toHaveBeenCalled();
  });
});
