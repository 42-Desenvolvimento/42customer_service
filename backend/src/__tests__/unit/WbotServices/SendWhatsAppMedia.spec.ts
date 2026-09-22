jest.mock("fs", () => ({
  unlinkSync: jest.fn()
}));

jest.mock("whatsapp-web.js", () => ({
  Message: jest.fn(),
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
import AppError from "../../../errors/AppError";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import UserMessagesLog from "../../../models/UserMessagesLog";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { logger } from "../../../utils/logger";

const getTicketWbotMock = GetTicketWbot as jest.Mock;
const fromFilePathMock = MessageMedia.fromFilePath as jest.Mock;
const userMessagesLogCreateMock = UserMessagesLog.create as jest.Mock;
const unlinkSyncMock = fs.unlinkSync as jest.Mock;
const startWhatsAppSessionVerifyMock = StartWhatsAppSessionVerify as jest.Mock;
const loggerErrorMock = logger.error as jest.Mock;

const media = {
  path: "/tmp/uploaded-audio.ogg",
  filename: "uploaded-audio.ogg"
} as Express.Multer.File;

const buildTicket = (overrides = {}) =>
  ({
    id: 88,
    whatsappId: 9,
    isGroup: true,
    contact: {
      number: "551188887777"
    },
    update: jest.fn().mockResolvedValue(undefined),
    ...overrides
  } as any);

describe("SendWhatsAppMedia", () => {
  it("sends media, records the user log and removes the uploaded file", async () => {
    const ticket = buildTicket();
    const newMedia = { mimetype: "audio/ogg" };
    const sentMessage = { id: { id: "wbot-message-id" } };
    const sendMessage = jest.fn().mockResolvedValue(sentMessage);

    getTicketWbotMock.mockResolvedValue({ sendMessage });
    fromFilePathMock.mockReturnValue(newMedia);
    userMessagesLogCreateMock.mockResolvedValue({});

    const result = await SendWhatsAppMedia({
      media,
      ticket,
      userId: "42"
    });

    expect(result).toBe(sentMessage);
    expect(fromFilePathMock).toHaveBeenCalledWith("/tmp/uploaded-audio.ogg");
    expect(sendMessage).toHaveBeenCalledWith(
      "551188887777@g.us",
      newMedia,
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: "uploaded-audio.ogg",
      lastMessageAt: expect.any(Number)
    });
    expect(userMessagesLogCreateMock).toHaveBeenCalledWith({
      messageId: "wbot-message-id",
      userId: "42",
      ticketId: 88
    });
    expect(unlinkSyncMock).toHaveBeenCalledWith("/tmp/uploaded-audio.ogg");
  });

  it("verifies the whatsapp session and raises an app error when sending fails", async () => {
    const ticket = buildTicket({ isGroup: false });
    const sendError = new Error("session closed");
    const sendMessage = jest.fn().mockRejectedValue(sendError);

    getTicketWbotMock.mockResolvedValue({ sendMessage });
    fromFilePathMock.mockReturnValue({ mimetype: "image/png" });

    await expect(
      SendWhatsAppMedia({
        media,
        ticket,
        userId: 42
      })
    ).rejects.toMatchObject(
      new AppError("ERR_SENDING_WAPP_MSG")
    );

    expect(startWhatsAppSessionVerifyMock).toHaveBeenCalledWith(9, sendError);
    expect(loggerErrorMock).toHaveBeenCalledWith(
      `SendWhatsAppMedia | Error: ${sendError}`
    );
    expect(ticket.update).not.toHaveBeenCalled();
    expect(userMessagesLogCreateMock).not.toHaveBeenCalled();
    expect(unlinkSyncMock).not.toHaveBeenCalled();
  });
});
