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

import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import UserMessagesLog from "../../../models/UserMessagesLog";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";

describe("SendWhatsAppMedia", () => {
  const media = {
    path: "/tmp/audio.ogg",
    filename: "audio.ogg"
  } as Express.Multer.File;

  const makeTicket = () => ({
    id: 10,
    whatsappId: 30,
    isGroup: false,
    contact: {
      number: "5511999999999"
    },
    update: jest.fn()
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (MessageMedia.fromFilePath as jest.Mock).mockReturnValue({
      mimetype: "audio/ogg",
      data: "encoded-media"
    });
  });

  it("sends the media, updates ticket metadata, logs the user and deletes the local file", async () => {
    const sendMessage = jest.fn().mockResolvedValue({
      id: {
        id: "wbot-message-id"
      }
    });
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendMessage });
    const ticket = makeTicket();

    const result = await SendWhatsAppMedia({
      media,
      ticket: ticket as never,
      userId: 99
    });

    expect(MessageMedia.fromFilePath).toHaveBeenCalledWith("/tmp/audio.ogg");
    expect(sendMessage).toHaveBeenCalledWith(
      "5511999999999@c.us",
      {
        mimetype: "audio/ogg",
        data: "encoded-media"
      },
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: "audio.ogg",
      lastMessageAt: expect.any(Number)
    });
    expect(UserMessagesLog.create).toHaveBeenCalledWith({
      messageId: "wbot-message-id",
      userId: 99,
      ticketId: 10
    });
    expect(fs.unlinkSync).toHaveBeenCalledWith("/tmp/audio.ogg");
    expect(result).toMatchObject({
      id: {
        id: "wbot-message-id"
      }
    });
  });

  it("verifies the WhatsApp session and throws AppError when sending media fails", async () => {
    const error = new Error("session closed");
    const sendMessage = jest.fn().mockRejectedValue(error);
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendMessage });
    const ticket = makeTicket();

    await expect(
      SendWhatsAppMedia({
        media,
        ticket: ticket as never,
        userId: 99
      })
    ).rejects.toMatchObject({
      message: "ERR_SENDING_WAPP_MSG",
      statusCode: 400
    });

    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(30, error);
    expect(UserMessagesLog.create).not.toHaveBeenCalled();
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
});
