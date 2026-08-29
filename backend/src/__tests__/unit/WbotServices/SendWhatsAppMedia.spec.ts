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

jest.mock(
  "../../../services/WbotServices/StartWhatsAppSessionVerify",
  () => ({
    StartWhatsAppSessionVerify: jest.fn()
  })
);

import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import AppError from "../../../errors/AppError";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import UserMessagesLog from "../../../models/UserMessagesLog";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

describe("SendWhatsAppMedia", () => {
  const unlinkSyncMock = fs.unlinkSync as jest.Mock;
  const fromFilePathMock = MessageMedia.fromFilePath as jest.Mock;
  const getTicketWbotMock = GetTicketWbot as jest.Mock;
  const userMessagesLogCreateMock = UserMessagesLog.create as jest.Mock;
  const startWhatsAppSessionVerifyMock =
    StartWhatsAppSessionVerify as jest.Mock;

  const media = {
    path: "/tmp/upload/audio.ogg",
    filename: "audio.ogg"
  } as Express.Multer.File;

  const createTicket = () =>
    ({
      id: 321,
      whatsappId: 99,
      isGroup: false,
      contact: {
        number: "5511888888888"
      },
      update: jest.fn().mockResolvedValue(undefined)
    } as any);

  beforeEach(() => {
    jest.clearAllMocks();
    fromFilePathMock.mockReturnValue({ mimetype: "audio/ogg" });
  });

  it("sends media, updates ticket and records the user message log", async () => {
    const ticket = createTicket();
    const sentMessage = {
      id: {
        id: "message-id"
      }
    };
    const sendMessage = jest.fn().mockResolvedValue(sentMessage);
    getTicketWbotMock.mockResolvedValue({ sendMessage });

    const result = await SendWhatsAppMedia({
      media,
      ticket,
      userId: 10
    });

    expect(result).toBe(sentMessage);
    expect(fromFilePathMock).toHaveBeenCalledWith("/tmp/upload/audio.ogg");
    expect(sendMessage).toHaveBeenCalledWith(
      "5511888888888@c.us",
      { mimetype: "audio/ogg" },
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: "audio.ogg",
      lastMessageAt: expect.any(Number)
    });
    expect(userMessagesLogCreateMock).toHaveBeenCalledWith({
      messageId: "message-id",
      userId: 10,
      ticketId: 321
    });
    expect(unlinkSyncMock).toHaveBeenCalledWith("/tmp/upload/audio.ogg");
    expect(startWhatsAppSessionVerifyMock).not.toHaveBeenCalled();
  });

  it("verifies the WhatsApp session and throws AppError when sending fails", async () => {
    const ticket = createTicket();
    const sendError = new Error("send failed");
    const sendMessage = jest.fn().mockRejectedValue(sendError);
    getTicketWbotMock.mockResolvedValue({ sendMessage });

    let error: AppError | undefined;
    try {
      await SendWhatsAppMedia({
        media,
        ticket,
        userId: 10
      });
    } catch (err) {
      error = err as AppError;
    }

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({
      message: "ERR_SENDING_WAPP_MSG",
      statusCode: 400
    });
    expect(startWhatsAppSessionVerifyMock).toHaveBeenCalledWith(99, sendError);
    expect(unlinkSyncMock).not.toHaveBeenCalled();
  });
});
