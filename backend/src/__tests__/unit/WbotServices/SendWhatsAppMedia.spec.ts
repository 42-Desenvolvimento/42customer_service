import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import AppError from "../../../errors/AppError";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import Ticket from "../../../models/Ticket";
import UserMessagesLog from "../../../models/UserMessagesLog";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { logger } from "../../../utils/logger";

jest.mock("fs", () => ({
  unlinkSync: jest.fn()
}));

jest.mock("whatsapp-web.js", () => ({
  MessageMedia: {
    fromFilePath: jest.fn(() => ({ mimetype: "image/png" }))
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

const makeTicket = () =>
  ({
    id: 123,
    whatsappId: 9,
    isGroup: false,
    contact: {
      number: "5511999999999"
    },
    update: jest.fn()
  } as unknown as Ticket);

const media = {
  path: "/tmp/media-file.png",
  filename: "media-file.png"
} as Express.Multer.File;

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends media, updates the ticket and removes the local file", async () => {
    const ticket = makeTicket();
    const sentMessage = {
      id: {
        id: "wamid.123"
      }
    };
    const sendMessage = jest.fn().mockResolvedValue(sentMessage);
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendMessage });

    const result = await SendWhatsAppMedia({
      media,
      ticket,
      userId: 77
    });

    expect(result).toBe(sentMessage);
    expect(MessageMedia.fromFilePath).toHaveBeenCalledWith(media.path);
    expect(sendMessage).toHaveBeenCalledWith(
      "5511999999999@c.us",
      { mimetype: "image/png" },
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: media.filename,
      lastMessageAt: expect.any(Number)
    });
    expect(UserMessagesLog.create).toHaveBeenCalledWith({
      messageId: "wamid.123",
      userId: 77,
      ticketId: 123
    });
    expect(fs.unlinkSync).toHaveBeenCalledWith(media.path);
    expect(StartWhatsAppSessionVerify).not.toHaveBeenCalled();
  });

  it("verifies the WhatsApp session and throws AppError when sending fails", async () => {
    const ticket = makeTicket();
    const error = new Error("session closed");
    const sendMessage = jest.fn().mockRejectedValue(error);
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendMessage });

    await expect(
      SendWhatsAppMedia({
        media,
        ticket,
        userId: undefined
      })
    ).rejects.toEqual(new AppError("ERR_SENDING_WAPP_MSG"));

    expect(logger.error).toHaveBeenCalledWith(`SendWhatsAppMedia | Error: ${error}`);
    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(9, error);
    expect(UserMessagesLog.create).not.toHaveBeenCalled();
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
});
