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

import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import AppError from "../../../errors/AppError";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import UserMessagesLog from "../../../models/UserMessagesLog";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

const getTicketWbotMock = GetTicketWbot as jest.Mock;
const fromFilePathMock = MessageMedia.fromFilePath as jest.Mock;
const unlinkSyncMock = fs.unlinkSync as jest.Mock;
const userMessagesLogCreateMock = UserMessagesLog.create as jest.Mock;
const startWhatsAppSessionVerifyMock = StartWhatsAppSessionVerify as jest.Mock;

const buildTicket = () =>
  ({
    id: 7,
    whatsappId: 21,
    isGroup: false,
    contact: {
      number: "5511999999999"
    },
    update: jest.fn().mockResolvedValue(undefined)
  } as any);

const media = {
  path: "/tmp/audio.ogg",
  filename: "audio.ogg"
} as Express.Multer.File;

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends media, updates the ticket and records the user message log", async () => {
    const ticket = buildTicket();
    const mediaPayload = { mimetype: "audio/ogg" };
    const sentMessage = { id: { id: "wa-message-id" } };
    const wbot = {
      sendMessage: jest.fn().mockResolvedValue(sentMessage)
    };

    getTicketWbotMock.mockResolvedValue(wbot);
    fromFilePathMock.mockReturnValue(mediaPayload);

    const result = await SendWhatsAppMedia({
      media,
      ticket,
      userId: 42
    });

    expect(result).toBe(sentMessage);
    expect(fromFilePathMock).toHaveBeenCalledWith(media.path);
    expect(wbot.sendMessage).toHaveBeenCalledWith(
      "5511999999999@c.us",
      mediaPayload,
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: media.filename,
      lastMessageAt: expect.any(Number)
    });
    expect(userMessagesLogCreateMock).toHaveBeenCalledWith({
      messageId: "wa-message-id",
      userId: 42,
      ticketId: ticket.id
    });
    expect(unlinkSyncMock).toHaveBeenCalledWith(media.path);
    expect(startWhatsAppSessionVerifyMock).not.toHaveBeenCalled();
  });

  it("starts WhatsApp session recovery when sending media fails", async () => {
    const ticket = buildTicket();
    const mediaPayload = { mimetype: "audio/ogg" };
    const sendError = new Error("Session closed");
    const wbot = {
      sendMessage: jest.fn().mockRejectedValue(sendError)
    };

    getTicketWbotMock.mockResolvedValue(wbot);
    fromFilePathMock.mockReturnValue(mediaPayload);

    try {
      await SendWhatsAppMedia({
        media,
        ticket,
        userId: 42
      });
      fail("Expected SendWhatsAppMedia to reject");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect(err).toMatchObject({
        message: "ERR_SENDING_WAPP_MSG",
        statusCode: 400
      });
    }
    expect(startWhatsAppSessionVerifyMock).toHaveBeenCalledWith(
      ticket.whatsappId,
      sendError
    );
    expect(ticket.update).not.toHaveBeenCalled();
    expect(userMessagesLogCreateMock).not.toHaveBeenCalled();
    expect(unlinkSyncMock).not.toHaveBeenCalled();
  });
});
