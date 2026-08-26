jest.mock("fs", () => ({
  unlinkSync: jest.fn()
}));

jest.mock("whatsapp-web.js", () => ({
  MessageMedia: {
    fromFilePath: jest.fn()
  }
}));

jest.mock("../../helpers/GetTicketWbot", () => jest.fn());

jest.mock("../../models/UserMessagesLog", () => ({
  create: jest.fn()
}));

jest.mock("../../utils/logger", () => ({
  logger: {
    error: jest.fn()
  }
}));

jest.mock("../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));

import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import UserMessagesLog from "../../models/UserMessagesLog";
import { StartWhatsAppSessionVerify } from "../../services/WbotServices/StartWhatsAppSessionVerify";
import SendWhatsAppMedia from "../../services/WbotServices/SendWhatsAppMedia";

describe("SendWhatsAppMedia", () => {
  const makeTicket = () =>
    ({
      id: 23,
      whatsappId: 7,
      isGroup: true,
      contact: {
        number: "5511888888888"
      },
      update: jest.fn().mockResolvedValue(undefined)
    } as any);

  const media = {
    path: "/tmp/audio.ogg",
    filename: "audio.ogg"
  } as Express.Multer.File;

  beforeEach(() => {
    jest.clearAllMocks();
    (MessageMedia.fromFilePath as jest.Mock).mockReturnValue({
      mimetype: "audio/ogg"
    });
  });

  it("sends media, updates the ticket and records the user message log", async () => {
    const ticket = makeTicket();
    const sentMessage = { id: { id: "message-id" } };
    const sendMessage = jest.fn().mockResolvedValue(sentMessage);
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendMessage });
    (UserMessagesLog.create as jest.Mock).mockResolvedValue(undefined);

    const result = await SendWhatsAppMedia({
      media,
      ticket,
      userId: 42
    });

    expect(result).toBe(sentMessage);
    expect(MessageMedia.fromFilePath).toHaveBeenCalledWith("/tmp/audio.ogg");
    expect(sendMessage).toHaveBeenCalledWith(
      "5511888888888@g.us",
      { mimetype: "audio/ogg" },
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: "audio.ogg",
      lastMessageAt: expect.any(Number)
    });
    expect(UserMessagesLog.create).toHaveBeenCalledWith({
      messageId: "message-id",
      userId: 42,
      ticketId: 23
    });
    expect(fs.unlinkSync).toHaveBeenCalledWith("/tmp/audio.ogg");
  });

  it("verifies the WhatsApp session and throws an AppError when media send fails", async () => {
    const ticket = makeTicket();
    const sendError = new Error("ERR_WAPP_NOT_INITIALIZED");
    const sendMessage = jest.fn().mockRejectedValue(sendError);
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendMessage });

    await expect(
      SendWhatsAppMedia({
        media,
        ticket,
        userId: 42
      })
    ).rejects.toBeInstanceOf(AppError);

    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(7, sendError);
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
});

export {};
