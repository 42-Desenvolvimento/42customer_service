import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import AppError from "../../../errors/AppError";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import UserMessagesLog from "../../../models/UserMessagesLog";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

const mockUnlinkSync = jest.fn();
const mockFromFilePath = jest.fn();
const mockGetTicketWbot = jest.fn();
const mockUserMessagesLogCreate = jest.fn();
const mockStartWhatsAppSessionVerify = jest.fn();
const mockLoggerError = jest.fn();

jest.mock("fs", () => ({
  unlinkSync: mockUnlinkSync
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

jest.mock(
  "../../../services/WbotServices/StartWhatsAppSessionVerify",
  () => ({
    StartWhatsAppSessionVerify: mockStartWhatsAppSessionVerify
  })
);

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: mockLoggerError
  }
}));

describe("SendWhatsAppMedia", () => {
  const media = {
    path: "/tmp/audio.ogg",
    filename: "audio.ogg"
  } as Express.Multer.File;

  const buildTicket = (overrides = {}) =>
    ({
      id: 321,
      whatsappId: 77,
      isGroup: false,
      contact: {
        number: "5511888888888"
      },
      update: jest.fn().mockResolvedValue(undefined),
      ...overrides
    } as any);

  beforeEach(() => {
    jest.clearAllMocks();
    mockFromFilePath.mockReturnValue({ data: "media" });
    mockUserMessagesLogCreate.mockResolvedValue(undefined);
  });

  it("envia mídia, atualiza o ticket, registra usuario e remove arquivo local", async () => {
    const sendMessageResult = {
      id: {
        id: "message-id"
      }
    };
    const sendMessage = jest.fn().mockResolvedValue(sendMessageResult);
    mockGetTicketWbot.mockResolvedValue({ sendMessage });
    const ticket = buildTicket({ isGroup: true });

    const result = await SendWhatsAppMedia({
      media,
      ticket,
      userId: 15
    });

    expect(result).toBe(sendMessageResult);
    expect(MessageMedia.fromFilePath).toHaveBeenCalledWith(media.path);
    expect(GetTicketWbot).toHaveBeenCalledWith(ticket);
    expect(sendMessage).toHaveBeenCalledWith(
      "5511888888888@g.us",
      { data: "media" },
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: media.filename,
      lastMessageAt: expect.any(Number)
    });
    expect(UserMessagesLog.create).toHaveBeenCalledWith({
      messageId: "message-id",
      userId: 15,
      ticketId: ticket.id
    });
    expect(fs.unlinkSync).toHaveBeenCalledWith(media.path);
    expect(StartWhatsAppSessionVerify).not.toHaveBeenCalled();
  });

  it("aciona verificacao de sessao WhatsApp quando falha ao enviar a mídia", async () => {
    const error = new Error("session closed");
    const sendMessage = jest.fn().mockRejectedValue(error);
    mockGetTicketWbot.mockResolvedValue({ sendMessage });
    const ticket = buildTicket();

    await expect(
      SendWhatsAppMedia({
        media,
        ticket,
        userId: undefined
      })
    ).rejects.toEqual(expect.objectContaining(new AppError("ERR_SENDING_WAPP_MSG")));

    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(
      ticket.whatsappId,
      error
    );
    expect(mockLoggerError).toHaveBeenCalledWith(
      `SendWhatsAppMedia | Error: ${error}`
    );
    expect(UserMessagesLog.create).not.toHaveBeenCalled();
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
});
