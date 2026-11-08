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

import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import UserMessagesLog from "../../../models/UserMessagesLog";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { logger } from "../../../utils/logger";

const makeTicket = (overrides = {}) =>
  ({
    id: 321,
    whatsappId: 99,
    isGroup: true,
    contact: {
      number: "5511888888888"
    },
    update: jest.fn().mockResolvedValue(undefined),
    ...overrides
  } as any);

const makeMedia = () =>
  ({
    path: "/tmp/audio-message.ogg",
    filename: "audio-message.ogg"
  } as Express.Multer.File);

describe("SendWhatsAppMedia", () => {
  const unlinkSyncMock = fs.unlinkSync as jest.Mock;
  const fromFilePathMock = MessageMedia.fromFilePath as jest.Mock;
  const getTicketWbotMock = GetTicketWbot as jest.Mock;
  const userMessagesLogCreateMock = UserMessagesLog.create as jest.Mock;
  const startWhatsAppSessionVerifyMock = StartWhatsAppSessionVerify as jest.Mock;
  const loggerErrorMock = logger.error as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    fromFilePathMock.mockReturnValue({ mimetype: "audio/ogg" });
  });

  it("sends media, updates the ticket and records the user message log", async () => {
    const ticket = makeTicket();
    const media = makeMedia();
    const sentMessage = { id: { id: "message-id" } };
    const sendMessageMock = jest.fn().mockResolvedValue(sentMessage);
    getTicketWbotMock.mockResolvedValue({ sendMessage: sendMessageMock });

    const result = await SendWhatsAppMedia({
      media,
      ticket,
      userId: 12
    });

    expect(result).toBe(sentMessage);
    expect(fromFilePathMock).toHaveBeenCalledWith(media.path);
    expect(sendMessageMock).toHaveBeenCalledWith(
      "5511888888888@g.us",
      { mimetype: "audio/ogg" },
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: media.filename,
      lastMessageAt: expect.any(Number)
    });
    expect(userMessagesLogCreateMock).toHaveBeenCalledWith({
      messageId: "message-id",
      userId: 12,
      ticketId: ticket.id
    });
    expect(unlinkSyncMock).toHaveBeenCalledWith(media.path);
  });

  it("logs but does not fail the send when user message log creation fails", async () => {
    const ticket = makeTicket({ isGroup: false });
    const media = makeMedia();
    const sentMessage = { id: { id: "message-id" } };
    const logError = new Error("database timeout");
    getTicketWbotMock.mockResolvedValue({
      sendMessage: jest.fn().mockResolvedValue(sentMessage)
    });
    userMessagesLogCreateMock.mockRejectedValue(logError);

    await expect(
      SendWhatsAppMedia({
        media,
        ticket,
        userId: "agent-1"
      })
    ).resolves.toBe(sentMessage);

    expect(loggerErrorMock).toHaveBeenCalledWith(
      `Error criar log mensagem ${logError}`
    );
    expect(unlinkSyncMock).toHaveBeenCalledWith(media.path);
  });

  it("starts WhatsApp session recovery and throws AppError when sending fails", async () => {
    const ticket = makeTicket({ whatsappId: 101 });
    const media = makeMedia();
    const error = new Error("session closed");
    getTicketWbotMock.mockResolvedValue({
      sendMessage: jest.fn().mockRejectedValue(error)
    });

    await expect(
      SendWhatsAppMedia({
        media,
        ticket,
        userId: undefined
      })
    ).rejects.toMatchObject({
      message: "ERR_SENDING_WAPP_MSG",
      statusCode: 400
    });

    expect(loggerErrorMock).toHaveBeenCalledWith(
      `SendWhatsAppMedia | Error: ${error}`
    );
    expect(startWhatsAppSessionVerifyMock).toHaveBeenCalledWith(
      ticket.whatsappId,
      error
    );
    expect(unlinkSyncMock).not.toHaveBeenCalled();
  });
});
