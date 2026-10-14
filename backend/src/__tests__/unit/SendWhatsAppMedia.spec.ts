jest.mock("fs", () => ({ unlinkSync: jest.fn() }));
jest.mock("whatsapp-web.js", () => ({
  MessageMedia: {
    fromFilePath: jest.fn()
  }
}));
jest.mock("../../helpers/GetTicketWbot", () => jest.fn());
jest.mock("../../models/UserMessagesLog", () => ({ create: jest.fn() }));
jest.mock("../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));
jest.mock("../../utils/logger", () => ({
  logger: {
    error: jest.fn()
  }
}));

import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import UserMessagesLog from "../../models/UserMessagesLog";
import { StartWhatsAppSessionVerify } from "../../services/WbotServices/StartWhatsAppSessionVerify";
import SendWhatsAppMedia from "../../services/WbotServices/SendWhatsAppMedia";

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends media, updates the ticket and records the user message log", async () => {
    const mediaPayload = { mimetype: "image/png", data: "payload" };
    const sentMessage = { id: { id: "message-id" } };
    const sendMessage = jest.fn().mockResolvedValue(sentMessage);
    const ticket = {
      id: 321,
      whatsappId: 88,
      isGroup: false,
      contact: {
        number: "551188887777"
      },
      update: jest.fn().mockResolvedValue(undefined)
    };
    const media = {
      path: "/tmp/image.png",
      filename: "image.png"
    };

    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendMessage });
    (MessageMedia.fromFilePath as jest.Mock).mockReturnValue(mediaPayload);

    const result = await SendWhatsAppMedia({
      media: media as Express.Multer.File,
      ticket: ticket as any,
      userId: 99
    });

    expect(result).toBe(sentMessage);
    expect(MessageMedia.fromFilePath).toHaveBeenCalledWith("/tmp/image.png");
    expect(sendMessage).toHaveBeenCalledWith(
      "551188887777@c.us",
      mediaPayload,
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: "image.png",
      lastMessageAt: expect.any(Number)
    });
    expect(UserMessagesLog.create).toHaveBeenCalledWith({
      messageId: "message-id",
      userId: 99,
      ticketId: 321
    });
    expect(fs.unlinkSync).toHaveBeenCalledWith("/tmp/image.png");
  });

  it("starts WhatsApp session verification when sending media fails", async () => {
    const sendError = new Error("Session closed");
    const sendMessage = jest.fn().mockRejectedValue(sendError);
    const ticket = {
      id: 321,
      whatsappId: 88,
      isGroup: true,
      contact: {
        number: "551188887777"
      },
      update: jest.fn()
    };
    const media = {
      path: "/tmp/audio.ogg",
      filename: "audio.ogg"
    };

    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendMessage });
    (MessageMedia.fromFilePath as jest.Mock).mockReturnValue({
      mimetype: "audio/ogg"
    });

    await expect(
      SendWhatsAppMedia({
        media: media as Express.Multer.File,
        ticket: ticket as any,
        userId: 99
      })
    ).rejects.toMatchObject({ message: "ERR_SENDING_WAPP_MSG" });

    expect(sendMessage).toHaveBeenCalledWith(
      "551188887777@g.us",
      { mimetype: "audio/ogg" },
      { sendAudioAsVoice: true }
    );
    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(88, sendError);
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
});

export {};
