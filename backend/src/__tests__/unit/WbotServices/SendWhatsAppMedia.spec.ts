import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import AppError from "../../../errors/AppError";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import UserMessagesLog from "../../../models/UserMessagesLog";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

jest.mock("fs", () => ({
  unlinkSync: jest.fn()
}));
jest.mock("whatsapp-web.js", () => ({
  MessageMedia: {
    fromFilePath: jest.fn()
  }
}));
jest.mock("../../../helpers/GetTicketWbot", () => jest.fn());
jest.mock("../../../models/UserMessagesLog", () => ({
  create: jest.fn()
}));
jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));
jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn()
  }
}));

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (MessageMedia.fromFilePath as jest.Mock).mockReturnValue({
      mimetype: "image/png",
      data: "media-content"
    });
  });

  it("should update the ticket, create the user log and remove the temp file after sending", async () => {
    const sendMessageResponse = {
      id: {
        id: "message-id"
      }
    };
    const sendMessage = jest.fn().mockResolvedValue(sendMessageResponse);
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendMessage });
    (UserMessagesLog.create as jest.Mock).mockResolvedValue({});
    const ticket = {
      id: 12,
      whatsappId: 77,
      isGroup: true,
      contact: {
        number: "5511888888888"
      },
      update: jest.fn().mockResolvedValue(undefined)
    };
    const media = {
      path: "/tmp/upload.png",
      filename: "upload.png"
    };

    const response = await SendWhatsAppMedia({
      media: media as Express.Multer.File,
      ticket: ticket as any,
      userId: 55
    });

    expect(response).toBe(sendMessageResponse);
    expect(MessageMedia.fromFilePath).toHaveBeenCalledWith("/tmp/upload.png");
    expect(sendMessage).toHaveBeenCalledWith(
      "5511888888888@g.us",
      {
        mimetype: "image/png",
        data: "media-content"
      },
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: "upload.png",
      lastMessageAt: expect.any(Number)
    });
    expect(UserMessagesLog.create).toHaveBeenCalledWith({
      messageId: "message-id",
      userId: 55,
      ticketId: 12
    });
    expect(fs.unlinkSync).toHaveBeenCalledWith("/tmp/upload.png");
    expect(StartWhatsAppSessionVerify).not.toHaveBeenCalled();
  });

  it("should trigger WhatsApp session verification before returning send failure", async () => {
    const sendError = new Error("session closed");
    const sendMessage = jest.fn().mockRejectedValue(sendError);
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendMessage });
    const ticket = {
      id: 13,
      whatsappId: 78,
      isGroup: false,
      contact: {
        number: "5511777777777"
      },
      update: jest.fn()
    };
    const media = {
      path: "/tmp/failing-upload.png",
      filename: "failing-upload.png"
    };

    let thrownError: unknown;

    try {
      await SendWhatsAppMedia({
        media: media as Express.Multer.File,
        ticket: ticket as any,
        userId: undefined
      });
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeInstanceOf(AppError);
    expect(thrownError).toMatchObject({
      statusCode: 400,
      message: "ERR_SENDING_WAPP_MSG"
    });

    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(78, sendError);
    expect(ticket.update).not.toHaveBeenCalled();
    expect(UserMessagesLog.create).not.toHaveBeenCalled();
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
});
