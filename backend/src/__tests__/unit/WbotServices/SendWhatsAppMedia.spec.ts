import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import UserMessagesLog from "../../../models/UserMessagesLog";
import { logger } from "../../../utils/logger";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";

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
    path: "/tmp/audio.ogg",
    filename: "audio.ogg"
  } as Express.Multer.File;

  const buildTicket = () =>
    ({
      id: 99,
      whatsappId: 12,
      isGroup: false,
      contact: {
        number: "559999999999"
      },
      update: jest.fn()
    } as any);

  beforeEach(() => {
    jest.clearAllMocks();
    (MessageMedia.fromFilePath as jest.Mock).mockReturnValue({
      mimetype: "audio/ogg",
      data: "base64"
    });
  });

  it("should send media, update the ticket and remove the temporary file", async () => {
    const sendMessage = {
      id: {
        id: "message-id"
      }
    };
    const wbot = {
      sendMessage: jest.fn().mockResolvedValue(sendMessage)
    };
    const ticket = buildTicket();
    (GetTicketWbot as jest.Mock).mockResolvedValue(wbot);

    const result = await SendWhatsAppMedia({
      media,
      ticket,
      userId: 8
    });

    expect(result).toBe(sendMessage);
    expect(wbot.sendMessage).toHaveBeenCalledWith(
      "559999999999@c.us",
      {
        mimetype: "audio/ogg",
        data: "base64"
      },
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: "audio.ogg",
      lastMessageAt: expect.any(Number)
    });
    expect(UserMessagesLog.create).toHaveBeenCalledWith({
      messageId: "message-id",
      userId: 8,
      ticketId: 99
    });
    expect(fs.unlinkSync).toHaveBeenCalledWith("/tmp/audio.ogg");
    expect(StartWhatsAppSessionVerify).not.toHaveBeenCalled();
  });

  it("should verify the whatsapp session and throw AppError when sending fails", async () => {
    const sendError = new Error("session closed");
    const wbot = {
      sendMessage: jest.fn().mockRejectedValue(sendError)
    };
    const ticket = buildTicket();
    (GetTicketWbot as jest.Mock).mockResolvedValue(wbot);

    await expect(
      SendWhatsAppMedia({
        media,
        ticket,
        userId: 8
      })
    ).rejects.toMatchObject({
      message: "ERR_SENDING_WAPP_MSG",
      statusCode: 400
    });

    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(12, sendError);
    expect(fs.unlinkSync).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      `SendWhatsAppMedia | Error: ${sendError}`
    );
  });
});
