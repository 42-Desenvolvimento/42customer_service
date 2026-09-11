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
import { logger } from "../../../utils/logger";

const getTicketWbotMock = GetTicketWbot as jest.Mock;
const fromFilePathMock = MessageMedia.fromFilePath as jest.Mock;
const unlinkSyncMock = fs.unlinkSync as jest.Mock;
const createUserMessageLogMock = UserMessagesLog.create as jest.Mock;
const startWhatsAppSessionVerifyMock = StartWhatsAppSessionVerify as jest.Mock;
const loggerErrorMock = logger.error as jest.Mock;

const buildTicket = () =>
  ({
    id: 10,
    whatsappId: 5,
    isGroup: false,
    contact: {
      number: "5511999999999"
    },
    update: jest.fn()
  } as any);

const media = {
  path: "/tmp/audio.ogg",
  filename: "audio.ogg"
} as Express.Multer.File;

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should send media, update ticket and remove the temporary file", async () => {
    const ticket = buildTicket();
    const wbotMedia = { mimetype: "audio/ogg" };
    const sentMessage = { id: { id: "message-id" } };
    const wbot = {
      sendMessage: jest.fn().mockResolvedValue(sentMessage)
    };
    getTicketWbotMock.mockResolvedValue(wbot);
    fromFilePathMock.mockReturnValue(wbotMedia);

    const result = await SendWhatsAppMedia({
      media,
      ticket,
      userId: 88
    });

    expect(result).toBe(sentMessage);
    expect(fromFilePathMock).toHaveBeenCalledWith(media.path);
    expect(wbot.sendMessage).toHaveBeenCalledWith(
      "5511999999999@c.us",
      wbotMedia,
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: media.filename,
      lastMessageAt: expect.any(Number)
    });
    expect(createUserMessageLogMock).toHaveBeenCalledWith({
      messageId: "message-id",
      userId: 88,
      ticketId: 10
    });
    expect(unlinkSyncMock).toHaveBeenCalledWith(media.path);
    expect(startWhatsAppSessionVerifyMock).not.toHaveBeenCalled();
  });

  it("should verify the WhatsApp session before surfacing send failures", async () => {
    const ticket = buildTicket();
    const sendError = new Error("session closed");
    const wbot = {
      sendMessage: jest.fn().mockRejectedValue(sendError)
    };
    getTicketWbotMock.mockResolvedValue(wbot);
    fromFilePathMock.mockReturnValue({ mimetype: "audio/ogg" });

    await expect(
      SendWhatsAppMedia({
        media,
        ticket,
        userId: undefined
      })
    ).rejects.toBeInstanceOf(AppError);

    expect(loggerErrorMock).toHaveBeenCalledWith(
      `SendWhatsAppMedia | Error: ${sendError}`
    );
    expect(startWhatsAppSessionVerifyMock).toHaveBeenCalledWith(
      ticket.whatsappId,
      sendError
    );
    expect(unlinkSyncMock).not.toHaveBeenCalled();
  });
});
