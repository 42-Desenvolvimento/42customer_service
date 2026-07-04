import AppError from "../../../errors/AppError";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import UserMessagesLog from "../../../models/UserMessagesLog";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { MessageMedia } from "whatsapp-web.js";
import fs from "fs";

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
    path: "/tmp/audio.ogg",
    filename: "audio.ogg"
  } as Express.Multer.File;

  const makeTicket = () =>
    ({
      id: 33,
      whatsappId: 9,
      isGroup: false,
      contact: {
        number: "5511999999999"
      },
      update: jest.fn().mockResolvedValue(undefined)
    } as any);

  beforeEach(() => {
    jest.clearAllMocks();
    (MessageMedia.fromFilePath as jest.Mock).mockReturnValue({
      mimetype: "audio/ogg",
      data: "encoded"
    });
  });

  it("should send media, update ticket metadata, log the user message and remove the temp file", async () => {
    const ticket = makeTicket();
    const sentMessage = { id: { id: "message-id" } };
    const sendMessage = jest.fn().mockResolvedValue(sentMessage);

    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendMessage });

    const result = await SendWhatsAppMedia({
      media,
      ticket,
      userId: 42
    });

    expect(result).toBe(sentMessage);
    expect(MessageMedia.fromFilePath).toHaveBeenCalledWith(media.path);
    expect(sendMessage).toHaveBeenCalledWith(
      "5511999999999@c.us",
      { mimetype: "audio/ogg", data: "encoded" },
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: media.filename,
      lastMessageAt: expect.any(Number)
    });
    expect(UserMessagesLog.create).toHaveBeenCalledWith({
      messageId: "message-id",
      userId: 42,
      ticketId: ticket.id
    });
    expect(fs.unlinkSync).toHaveBeenCalledWith(media.path);
    expect(StartWhatsAppSessionVerify).not.toHaveBeenCalled();
  });

  it("should verify the WhatsApp session and throw an AppError when media sending fails", async () => {
    const ticket = makeTicket();
    const error = new Error("session closed");
    const sendMessage = jest.fn().mockRejectedValue(error);

    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendMessage });

    await expect(
      SendWhatsAppMedia({
        media,
        ticket,
        userId: 42
      })
    ).rejects.toBeInstanceOf(AppError);

    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(
      ticket.whatsappId,
      error
    );
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
});
