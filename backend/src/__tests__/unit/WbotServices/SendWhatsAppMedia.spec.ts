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
  const getTicketWbotMock = GetTicketWbot as jest.Mock;
  const fromFilePathMock = MessageMedia.fromFilePath as jest.Mock;
  const userMessagesLogCreateMock = UserMessagesLog.create as jest.Mock;
  const unlinkSyncMock = fs.unlinkSync as jest.Mock;
  const startWhatsAppSessionVerifyMock = StartWhatsAppSessionVerify as jest.Mock;
  const loggerErrorMock = logger.error as jest.Mock;

  const media = {
    path: "/tmp/audio.ogg",
    filename: "audio.ogg"
  } as Express.Multer.File;

  const makeTicket = (overrides = {}) =>
    ({
      id: 21,
      whatsappId: 55,
      isGroup: false,
      contact: {
        number: "5511888888888"
      },
      update: jest.fn().mockResolvedValue(undefined),
      ...overrides
    } as any);

  beforeEach(() => {
    jest.clearAllMocks();
    fromFilePathMock.mockReturnValue({ mimetype: "audio/ogg" });
    userMessagesLogCreateMock.mockResolvedValue(undefined);
  });

  it("sends media, updates ticket metadata, stores user log, and removes the temp file", async () => {
    const sentMessage = {
      id: {
        id: "wamid.media-message"
      }
    };
    const sendMessageMock = jest.fn().mockResolvedValue(sentMessage);
    const ticket = makeTicket();
    getTicketWbotMock.mockResolvedValue({
      sendMessage: sendMessageMock
    });

    const result = await SendWhatsAppMedia({
      media,
      ticket,
      userId: 8
    });

    expect(result).toBe(sentMessage);
    expect(fromFilePathMock).toHaveBeenCalledWith("/tmp/audio.ogg");
    expect(sendMessageMock).toHaveBeenCalledWith(
      "5511888888888@c.us",
      { mimetype: "audio/ogg" },
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: "audio.ogg",
      lastMessageAt: expect.any(Number)
    });
    expect(userMessagesLogCreateMock).toHaveBeenCalledWith({
      messageId: "wamid.media-message",
      userId: 8,
      ticketId: 21
    });
    expect(unlinkSyncMock).toHaveBeenCalledWith("/tmp/audio.ogg");
  });

  it("does not fail the message when user log creation fails", async () => {
    const sentMessage = {
      id: {
        id: "wamid.media-message"
      }
    };
    const logError = new Error("database unavailable");
    userMessagesLogCreateMock.mockRejectedValue(logError);
    getTicketWbotMock.mockResolvedValue({
      sendMessage: jest.fn().mockResolvedValue(sentMessage)
    });

    await expect(
      SendWhatsAppMedia({
        media,
        ticket: makeTicket(),
        userId: 8
      })
    ).resolves.toBe(sentMessage);

    expect(loggerErrorMock).toHaveBeenCalledWith(
      `Error criar log mensagem ${logError}`
    );
    expect(unlinkSyncMock).toHaveBeenCalledWith("/tmp/audio.ogg");
  });

  it("verifies the whatsapp session and raises an AppError when sending fails", async () => {
    const error = new Error("send failed");
    const ticket = makeTicket({
      isGroup: true
    });
    getTicketWbotMock.mockResolvedValue({
      sendMessage: jest.fn().mockRejectedValue(error)
    });

    await expect(
      SendWhatsAppMedia({
        media,
        ticket,
        userId: undefined
      })
    ).rejects.toMatchObject<AppError>({
      message: "ERR_SENDING_WAPP_MSG",
      statusCode: 400
    });

    expect(startWhatsAppSessionVerifyMock).toHaveBeenCalledWith(55, error);
    expect(loggerErrorMock).toHaveBeenCalledWith(
      `SendWhatsAppMedia | Error: ${error}`
    );
    expect(unlinkSyncMock).not.toHaveBeenCalled();
  });
});
