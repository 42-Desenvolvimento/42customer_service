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

import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import UserMessagesLog from "../../../models/UserMessagesLog";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { logger } from "../../../utils/logger";

describe("SendWhatsAppMedia", () => {
  const media = {
    path: "/tmp/audio.ogg",
    filename: "audio.ogg"
  } as Express.Multer.File;

  const buildTicket = () =>
    ({
      id: 123,
      whatsappId: 55,
      isGroup: false,
      contact: {
        number: "5511999999999"
      },
      update: jest.fn()
    } as any);

  beforeEach(() => {
    jest.clearAllMocks();
    (MessageMedia.fromFilePath as jest.Mock).mockReturnValue({
      mimetype: "audio/ogg"
    });
  });

  it("should send media, update ticket and write the user message log", async () => {
    const ticket = buildTicket();
    const sendMessage = {
      id: {
        id: "message-id"
      }
    };
    const wbot = {
      sendMessage: jest.fn().mockResolvedValue(sendMessage)
    };

    (GetTicketWbot as jest.Mock).mockResolvedValue(wbot);

    await expect(
      SendWhatsAppMedia({ media, ticket, userId: 77 })
    ).resolves.toBe(sendMessage);

    expect(MessageMedia.fromFilePath).toHaveBeenCalledWith(media.path);
    expect(wbot.sendMessage).toHaveBeenCalledWith(
      "5511999999999@c.us",
      { mimetype: "audio/ogg" },
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: media.filename,
      lastMessageAt: expect.any(Number)
    });
    expect(UserMessagesLog.create).toHaveBeenCalledWith({
      messageId: "message-id",
      userId: 77,
      ticketId: ticket.id
    });
    expect(fs.unlinkSync).toHaveBeenCalledWith(media.path);
    expect(StartWhatsAppSessionVerify).not.toHaveBeenCalled();
  });

  it("should verify the WhatsApp session with the original error when sending media fails", async () => {
    const ticket = buildTicket();
    const sendError = new Error("Session closed");
    const wbot = {
      sendMessage: jest.fn().mockRejectedValue(sendError)
    };

    (GetTicketWbot as jest.Mock).mockResolvedValue(wbot);

    await expect(
      SendWhatsAppMedia({ media, ticket, userId: undefined })
    ).rejects.toMatchObject({
      message: "ERR_SENDING_WAPP_MSG",
      statusCode: 400
    });

    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(
      ticket.whatsappId,
      sendError
    );
    expect(logger.error).toHaveBeenCalledWith(
      `SendWhatsAppMedia | Error: ${sendError}`
    );
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
});
