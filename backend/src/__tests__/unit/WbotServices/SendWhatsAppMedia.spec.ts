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

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn()
  }
}));

jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));

describe("SendWhatsAppMedia", () => {
  const media = {
    path: "/tmp/uploaded-audio.ogg",
    filename: "uploaded-audio.ogg"
  } as Express.Multer.File;

  beforeEach(() => {
    jest.clearAllMocks();
    (MessageMedia.fromFilePath as jest.Mock).mockReturnValue({
      mimetype: "audio/ogg"
    });
  });

  it("sends media, updates the ticket and records the user message log", async () => {
    const sendMessage = {
      id: {
        id: "message-id"
      }
    };
    const wbot = {
      sendMessage: jest.fn().mockResolvedValue(sendMessage)
    };
    const updateTicket = jest.fn().mockResolvedValue(undefined);
    const ticket = {
      id: 10,
      whatsappId: 20,
      isGroup: true,
      contact: {
        number: "5511888888888"
      },
      update: updateTicket
    };

    (GetTicketWbot as jest.Mock).mockResolvedValue(wbot);
    (UserMessagesLog.create as jest.Mock).mockResolvedValue(undefined);

    const result = await SendWhatsAppMedia({
      media,
      ticket: ticket as any,
      userId: 30
    });

    expect(result).toBe(sendMessage);
    expect(MessageMedia.fromFilePath).toHaveBeenCalledWith(media.path);
    expect(wbot.sendMessage).toHaveBeenCalledWith(
      "5511888888888@g.us",
      { mimetype: "audio/ogg" },
      { sendAudioAsVoice: true }
    );
    expect(updateTicket).toHaveBeenCalledWith({
      lastMessage: media.filename,
      lastMessageAt: expect.any(Number)
    });
    expect(UserMessagesLog.create).toHaveBeenCalledWith({
      messageId: "message-id",
      userId: 30,
      ticketId: 10
    });
    expect(fs.unlinkSync).toHaveBeenCalledWith(media.path);
  });

  it("verifies the WhatsApp session and raises an app error when sending fails", async () => {
    const sendError = new Error("Protocol error: session closed");
    const wbot = {
      sendMessage: jest.fn().mockRejectedValue(sendError)
    };
    const ticket = {
      id: 11,
      whatsappId: 21,
      isGroup: false,
      contact: {
        number: "5511777777777"
      },
      update: jest.fn()
    };

    (GetTicketWbot as jest.Mock).mockResolvedValue(wbot);

    await expect(
      SendWhatsAppMedia({
        media,
        ticket: ticket as any,
        userId: undefined
      })
    ).rejects.toMatchObject<AppError>({
      message: "ERR_SENDING_WAPP_MSG",
      statusCode: 400
    });

    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(21, sendError);
    expect(fs.unlinkSync).not.toHaveBeenCalled();
    expect(UserMessagesLog.create).not.toHaveBeenCalled();
  });
});
