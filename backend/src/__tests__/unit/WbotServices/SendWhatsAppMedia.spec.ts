import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import AppError from "../../../errors/AppError";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import type Ticket from "../../../models/Ticket";
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
  const media = {
    path: "/tmp/audio.ogg",
    filename: "audio.ogg"
  } as Express.Multer.File;

  const makeTicket = (overrides: Partial<Ticket> = {}) =>
    ({
      id: 10,
      whatsappId: 30,
      isGroup: false,
      contact: {
        number: "5511999999999"
      },
      update: jest.fn().mockResolvedValue(undefined),
      ...overrides
    } as unknown as Ticket);

  beforeEach(() => {
    jest.clearAllMocks();
    (MessageMedia.fromFilePath as jest.Mock).mockReturnValue({
      mimetype: "audio/ogg",
      data: "base64"
    });
  });

  it("should send media, update the ticket, create a user message log and remove the local file", async () => {
    const sendMessageResult = { id: { id: "message-id" } };
    const sendMessage = jest.fn().mockResolvedValue(sendMessageResult);
    const ticket = makeTicket();
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendMessage });

    const result = await SendWhatsAppMedia({
      media,
      ticket,
      userId: 99
    });

    expect(MessageMedia.fromFilePath).toHaveBeenCalledWith("/tmp/audio.ogg");
    expect(sendMessage).toHaveBeenCalledWith(
      "5511999999999@c.us",
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
      userId: 99,
      ticketId: 10
    });
    expect(fs.unlinkSync).toHaveBeenCalledWith("/tmp/audio.ogg");
    expect(result).toBe(sendMessageResult);
  });

  it("should continue sending and clean up the file when user message logging fails", async () => {
    const logError = new Error("log insert failed");
    const sendMessageResult = { id: { id: "message-id" } };
    const sendMessage = jest.fn().mockResolvedValue(sendMessageResult);
    const ticket = makeTicket({ isGroup: true });
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendMessage });
    (UserMessagesLog.create as jest.Mock).mockRejectedValue(logError);

    const result = await SendWhatsAppMedia({
      media,
      ticket,
      userId: "42"
    });

    expect(sendMessage).toHaveBeenCalledWith(
      "5511999999999@g.us",
      expect.any(Object),
      { sendAudioAsVoice: true }
    );
    expect(logger.error).toHaveBeenCalledWith(
      `Error criar log mensagem ${logError}`
    );
    expect(fs.unlinkSync).toHaveBeenCalledWith("/tmp/audio.ogg");
    expect(result).toBe(sendMessageResult);
  });

  it("should verify whatsapp session and throw AppError when media sending fails", async () => {
    const sendError = new Error("session closed");
    const sendMessage = jest.fn().mockRejectedValue(sendError);
    const ticket = makeTicket();
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendMessage });

    await expect(
      SendWhatsAppMedia({
        media,
        ticket,
        userId: 99
      })
    ).rejects.toMatchObject(new AppError("ERR_SENDING_WAPP_MSG"));

    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(30, sendError);
    expect(logger.error).toHaveBeenCalledWith(
      `SendWhatsAppMedia | Error: ${sendError}`
    );
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
});

export {};
