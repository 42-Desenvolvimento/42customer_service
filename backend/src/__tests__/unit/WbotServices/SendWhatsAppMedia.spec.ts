import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import AppError from "../../../errors/AppError";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import UserMessagesLog from "../../../models/UserMessagesLog";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { logger } from "../../../utils/logger";

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

describe("SendWhatsAppMedia", () => {
  const media = {
    path: "/tmp/audio.ogg",
    filename: "audio.ogg"
  } as Express.Multer.File;

  const ticket = {
    id: 1,
    whatsappId: 3,
    isGroup: false,
    contact: {
      number: "5511999999999"
    },
    update: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    ticket.update.mockResolvedValue(undefined);
    (MessageMedia.fromFilePath as jest.Mock).mockReturnValue({
      mimetype: "audio/ogg"
    });
  });

  it("should send media, update ticket, create user log and remove local file", async () => {
    const sendMessage = {
      id: {
        id: "message-id"
      }
    };
    const wbot = {
      sendMessage: jest.fn().mockResolvedValue(sendMessage)
    };
    (GetTicketWbot as jest.Mock).mockResolvedValue(wbot);

    const result = await SendWhatsAppMedia({
      media,
      ticket: ticket as any,
      userId: 9
    });

    expect(result).toBe(sendMessage);
    expect(MessageMedia.fromFilePath).toHaveBeenCalledWith("/tmp/audio.ogg");
    expect(wbot.sendMessage).toHaveBeenCalledWith(
      "5511999999999@c.us",
      { mimetype: "audio/ogg" },
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: "audio.ogg",
      lastMessageAt: expect.any(Number)
    });
    expect(UserMessagesLog.create).toHaveBeenCalledWith({
      messageId: "message-id",
      userId: 9,
      ticketId: 1
    });
    expect(fs.unlinkSync).toHaveBeenCalledWith("/tmp/audio.ogg");
  });

  it("should verify whatsapp session and throw AppError when media send fails", async () => {
    const error = new Error("Session closed");
    const wbot = {
      sendMessage: jest.fn().mockRejectedValue(error)
    };
    (GetTicketWbot as jest.Mock).mockResolvedValue(wbot);

    await expect(
      SendWhatsAppMedia({
        media,
        ticket: ticket as any,
        userId: 9
      })
    ).rejects.toBeInstanceOf(AppError);

    expect(logger.error).toHaveBeenCalledWith(
      `SendWhatsAppMedia | Error: ${error}`
    );
    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(3, error);
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
});
