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

jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn()
  }
}));

import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import UserMessagesLog from "../../../models/UserMessagesLog";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";

describe("SendWhatsAppMedia", () => {
  const media = {
    filename: "audio.ogg",
    path: "/tmp/audio.ogg"
  } as Express.Multer.File;

  const buildTicket = () => ({
    id: 10,
    whatsappId: 20,
    isGroup: false,
    contact: {
      number: "5511888888888"
    },
    update: jest.fn().mockResolvedValue(undefined)
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (MessageMedia.fromFilePath as jest.Mock).mockReturnValue({
      mimetype: "audio/ogg"
    });
  });

  it("logs the user message, updates the ticket and removes the temp file on success", async () => {
    const ticket = buildTicket();
    const sentMessage = { id: { id: "message-id" } };
    const sendMessage = jest.fn().mockResolvedValue(sentMessage);
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendMessage });

    await expect(
      SendWhatsAppMedia({
        media,
        ticket: ticket as any,
        userId: 99
      })
    ).resolves.toBe(sentMessage);

    expect(MessageMedia.fromFilePath).toHaveBeenCalledWith("/tmp/audio.ogg");
    expect(sendMessage).toHaveBeenCalledWith(
      "5511888888888@c.us",
      { mimetype: "audio/ogg" },
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: "audio.ogg",
      lastMessageAt: expect.any(Number)
    });
    expect(UserMessagesLog.create).toHaveBeenCalledWith({
      messageId: "message-id",
      userId: 99,
      ticketId: 10
    });
    expect(fs.unlinkSync).toHaveBeenCalledWith("/tmp/audio.ogg");
    expect(StartWhatsAppSessionVerify).not.toHaveBeenCalled();
  });

  it("verifies the WhatsApp session and raises AppError when sending fails", async () => {
    const ticket = buildTicket();
    const sendError = new Error("session closed");
    const sendMessage = jest.fn().mockRejectedValue(sendError);
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendMessage });

    await expect(
      SendWhatsAppMedia({
        media,
        ticket: ticket as any,
        userId: 99
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
