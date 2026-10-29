jest.mock("fs", () => ({
  unlinkSync: jest.fn()
}));

jest.mock("whatsapp-web.js", () => ({
  MessageMedia: {
    fromFilePath: jest.fn()
  }
}));

jest.mock("../../helpers/GetTicketWbot", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../models/UserMessagesLog", () => ({
  __esModule: true,
  default: {
    create: jest.fn()
  }
}));

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

  it("updates the ticket, records the user log and removes the file after sending media", async () => {
    const mediaPayload = { mimetype: "image/png" };
    const sentMessage = { id: { id: "message-id" } };
    const sendMessage = jest.fn().mockResolvedValue(sentMessage);
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendMessage });
    (MessageMedia.fromFilePath as jest.Mock).mockReturnValue(mediaPayload);
    const ticket = {
      id: 10,
      whatsappId: 20,
      isGroup: true,
      contact: {
        number: "5511888888888"
      },
      update: jest.fn().mockResolvedValue(undefined)
    };
    const media = {
      path: "/tmp/media.png",
      filename: "media.png"
    };

    const response = await SendWhatsAppMedia({
      media: media as Express.Multer.File,
      ticket: ticket as any,
      userId: 30
    });

    expect(response).toBe(sentMessage);
    expect(MessageMedia.fromFilePath).toHaveBeenCalledWith("/tmp/media.png");
    expect(sendMessage).toHaveBeenCalledWith(
      "5511888888888@g.us",
      mediaPayload,
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: "media.png",
      lastMessageAt: expect.any(Number)
    });
    expect(UserMessagesLog.create).toHaveBeenCalledWith({
      messageId: "message-id",
      userId: 30,
      ticketId: 10
    });
    expect(fs.unlinkSync).toHaveBeenCalledWith("/tmp/media.png");
    expect(StartWhatsAppSessionVerify).not.toHaveBeenCalled();
  });

  it("starts WhatsApp session verification and raises an AppError when sending media fails", async () => {
    const sendError = new Error("ERR_WAPP_NOT_INITIALIZED");
    const sendMessage = jest.fn().mockRejectedValue(sendError);
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendMessage });
    (MessageMedia.fromFilePath as jest.Mock).mockReturnValue({
      mimetype: "image/png"
    });
    const ticket = {
      id: 10,
      whatsappId: 20,
      isGroup: false,
      contact: {
        number: "5511888888888"
      },
      update: jest.fn()
    };
    const media = {
      path: "/tmp/media.png",
      filename: "media.png"
    };

    await expect(
      SendWhatsAppMedia({
        media: media as Express.Multer.File,
        ticket: ticket as any,
        userId: undefined
      })
    ).rejects.toMatchObject({
      message: "ERR_SENDING_WAPP_MSG",
      statusCode: 400
    });

    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(20, sendError);
    expect(ticket.update).not.toHaveBeenCalled();
    expect(UserMessagesLog.create).not.toHaveBeenCalled();
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
});
