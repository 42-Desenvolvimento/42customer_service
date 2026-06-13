import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import UserMessagesLog from "../../models/UserMessagesLog";
import SendWhatsAppMedia from "../../services/WbotServices/SendWhatsAppMedia";
import { StartWhatsAppSessionVerify } from "../../services/WbotServices/StartWhatsAppSessionVerify";

jest.mock("fs", () => ({
  unlinkSync: jest.fn()
}));

jest.mock("whatsapp-web.js", () => ({
  MessageMedia: {
    fromFilePath: jest.fn(() => ({ mimetype: "image/png" }))
  }
}));

jest.mock("../../helpers/GetTicketWbot");
jest.mock("../../models/UserMessagesLog", () => ({
  create: jest.fn()
}));
jest.mock("../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));
jest.mock("../../utils/logger", () => ({
  logger: {
    error: jest.fn()
  }
}));

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should send media, update ticket, log user message and remove temp file", async () => {
    const sendMessage = { id: { id: "message-1" } };
    const wbot = {
      sendMessage: jest.fn().mockResolvedValue(sendMessage)
    };
    (GetTicketWbot as jest.Mock).mockResolvedValue(wbot);

    const ticket = {
      id: 10,
      whatsappId: 20,
      isGroup: false,
      contact: { number: "5511999999999" },
      update: jest.fn().mockResolvedValue(undefined)
    };
    const media = {
      path: "/tmp/audio.ogg",
      filename: "audio.ogg"
    } as Express.Multer.File;

    const result = await SendWhatsAppMedia({
      media,
      ticket: ticket as any,
      userId: 30
    });

    const mediaPayload = (MessageMedia.fromFilePath as jest.Mock).mock
      .results[0].value;

    expect(result).toBe(sendMessage);
    expect(MessageMedia.fromFilePath).toHaveBeenCalledWith(media.path);
    expect(wbot.sendMessage).toHaveBeenCalledWith(
      "5511999999999@c.us",
      mediaPayload,
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: "audio.ogg",
      lastMessageAt: expect.any(Number)
    });
    expect(UserMessagesLog.create).toHaveBeenCalledWith({
      messageId: "message-1",
      userId: 30,
      ticketId: 10
    });
    expect(fs.unlinkSync).toHaveBeenCalledWith(media.path);
    expect(StartWhatsAppSessionVerify).not.toHaveBeenCalled();
  });

  it("should verify the whatsapp session and throw AppError when media send fails", async () => {
    const sendError = new Error("session closed");
    const wbot = {
      sendMessage: jest.fn().mockRejectedValue(sendError)
    };
    (GetTicketWbot as jest.Mock).mockResolvedValue(wbot);

    const ticket = {
      id: 11,
      whatsappId: 21,
      isGroup: true,
      contact: { number: "5511888888888" },
      update: jest.fn()
    };
    const media = {
      path: "/tmp/image.png",
      filename: "image.png"
    } as Express.Multer.File;

    await expect(
      SendWhatsAppMedia({
        media,
        ticket: ticket as any,
        userId: undefined
      })
    ).rejects.toBeInstanceOf(AppError);

    expect(wbot.sendMessage).toHaveBeenCalledWith(
      "5511888888888@g.us",
      expect.any(Object),
      { sendAudioAsVoice: true }
    );
    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(21, sendError);
    expect(ticket.update).not.toHaveBeenCalled();
    expect(UserMessagesLog.create).not.toHaveBeenCalled();
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
});
