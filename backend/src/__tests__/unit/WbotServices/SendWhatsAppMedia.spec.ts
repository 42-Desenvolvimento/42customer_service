jest.mock("fs", () => ({ unlinkSync: jest.fn() }));
jest.mock("whatsapp-web.js", () => ({
  MessageMedia: {
    fromFilePath: jest.fn()
  }
}));
jest.mock("../../../helpers/GetTicketWbot", () => jest.fn());
jest.mock("../../../models/UserMessagesLog", () => ({ create: jest.fn() }));
jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn()
  }
}));
jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));

import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import UserMessagesLog from "../../../models/UserMessagesLog";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";

describe("SendWhatsAppMedia", () => {
  const media = {
    path: "/tmp/media.ogg",
    filename: "media.ogg"
  } as Express.Multer.File;

  const buildTicket = () =>
    ({
      id: 123,
      whatsappId: 5,
      isGroup: false,
      contact: {
        number: "555199999999"
      },
      update: jest.fn().mockResolvedValue(undefined)
    } as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("logs the sent media and removes the temporary file", async () => {
    const ticket = buildTicket();
    const messageMedia = { mimetype: "audio/ogg" };
    const sendMessage = {
      id: {
        id: "message-id"
      }
    };
    const wbot = {
      sendMessage: jest.fn().mockResolvedValue(sendMessage)
    };
    (GetTicketWbot as jest.Mock).mockResolvedValue(wbot);
    (MessageMedia.fromFilePath as jest.Mock).mockReturnValue(messageMedia);

    const response = await SendWhatsAppMedia({
      media,
      ticket,
      userId: 10
    });

    expect(response).toBe(sendMessage);
    expect(MessageMedia.fromFilePath).toHaveBeenCalledWith(media.path);
    expect(wbot.sendMessage).toHaveBeenCalledWith(
      "555199999999@c.us",
      messageMedia,
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: media.filename,
      lastMessageAt: expect.any(Number)
    });
    expect(UserMessagesLog.create).toHaveBeenCalledWith({
      messageId: "message-id",
      userId: 10,
      ticketId: ticket.id
    });
    expect(fs.unlinkSync).toHaveBeenCalledWith(media.path);
  });

  it("verifies the WhatsApp session before returning an AppError when sending fails", async () => {
    const ticket = buildTicket();
    const sendError = new Error("session closed");
    (GetTicketWbot as jest.Mock).mockRejectedValue(sendError);

    await expect(
      SendWhatsAppMedia({
        media,
        ticket,
        userId: 10
      })
    ).rejects.toMatchObject({
      message: "ERR_SENDING_WAPP_MSG",
      statusCode: 400
    });

    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(
      ticket.whatsappId,
      sendError
    );
    expect(fs.unlinkSync).not.toHaveBeenCalled();
    expect(UserMessagesLog.create).not.toHaveBeenCalled();
  });
});
