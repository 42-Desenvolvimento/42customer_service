jest.mock("fs", () => ({
  unlinkSync: jest.fn()
}));

jest.mock("whatsapp-web.js", () => ({
  MessageMedia: {
    fromFilePath: jest.fn()
  }
}));

jest.mock("../../../helpers/GetTicketWbot", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../models/UserMessagesLog", () => ({
  __esModule: true,
  default: {
    create: jest.fn()
  }
}));

jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn()
  }
}));

import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import AppError from "../../../errors/AppError";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import UserMessagesLog from "../../../models/UserMessagesLog";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

const buildTicket = (overrides: Record<string, any> = {}) => ({
  id: 321,
  whatsappId: 654,
  isGroup: false,
  contact: {
    number: "5511888888888"
  },
  update: jest.fn().mockResolvedValue(undefined),
  ...overrides
});

const buildMedia = (overrides: Record<string, any> = {}) => ({
  path: "/tmp/audio.ogg",
  filename: "audio.ogg",
  ...overrides
});

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("envia a mídia, atualiza o ticket e registra o usuário remetente", async () => {
    const mediaPayload = { mimetype: "audio/ogg" };
    const sendMessageResult = { id: { id: "message-id-1" } };
    const sendMessage = jest.fn().mockResolvedValue(sendMessageResult);
    const ticket = buildTicket();
    const media = buildMedia();

    (MessageMedia.fromFilePath as jest.Mock).mockReturnValue(mediaPayload);
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendMessage });

    const result = await SendWhatsAppMedia({
      media: media as any,
      ticket: ticket as any,
      userId: 10
    });

    expect(result).toBe(sendMessageResult);
    expect(MessageMedia.fromFilePath).toHaveBeenCalledWith("/tmp/audio.ogg");
    expect(sendMessage).toHaveBeenCalledWith(
      "5511888888888@c.us",
      mediaPayload,
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: "audio.ogg",
      lastMessageAt: expect.any(Number)
    });
    expect(UserMessagesLog.create).toHaveBeenCalledWith({
      messageId: "message-id-1",
      userId: 10,
      ticketId: 321
    });
    expect(fs.unlinkSync).toHaveBeenCalledWith("/tmp/audio.ogg");
  });

  it("aciona verificação da sessão e retorna AppError quando o envio falha", async () => {
    const mediaPayload = { mimetype: "image/png" };
    const sendError = new Error("wbot disconnected");
    const sendMessage = jest.fn().mockRejectedValue(sendError);
    const ticket = buildTicket({ whatsappId: 999 });
    const media = buildMedia({ path: "/tmp/image.png", filename: "image.png" });

    (MessageMedia.fromFilePath as jest.Mock).mockReturnValue(mediaPayload);
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendMessage });

    await expect(
      SendWhatsAppMedia({
        media: media as any,
        ticket: ticket as any,
        userId: undefined
      })
    ).rejects.toBeInstanceOf(AppError);

    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(999, sendError);
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
});

export {};
