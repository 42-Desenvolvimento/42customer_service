export {};

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
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import UserMessagesLog from "../../../models/UserMessagesLog";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

const getTicketWbotMock = GetTicketWbot as jest.Mock;
const messageMediaMock = MessageMedia.fromFilePath as jest.Mock;
const userMessagesLogMock = UserMessagesLog.create as jest.Mock;
const unlinkSyncMock = fs.unlinkSync as jest.Mock;
const startWhatsAppSessionVerifyMock = StartWhatsAppSessionVerify as jest.Mock;

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("logs the sent media message and removes the local file", async () => {
    const mediaObject = { mimetype: "image/png" };
    const sentMessage = {
      id: {
        id: "message-123"
      }
    };
    const sendMessage = jest.fn().mockResolvedValue(sentMessage);
    const ticket = {
      id: 10,
      whatsappId: 20,
      isGroup: false,
      contact: {
        number: "554299999999"
      },
      update: jest.fn()
    };
    const media = {
      filename: "receipt.png",
      path: "/tmp/receipt.png"
    } as Express.Multer.File;

    getTicketWbotMock.mockResolvedValue({ sendMessage });
    messageMediaMock.mockReturnValue(mediaObject);

    const result = await SendWhatsAppMedia({
      media,
      ticket: ticket as any,
      userId: 99
    });

    expect(result).toBe(sentMessage);
    expect(messageMediaMock).toHaveBeenCalledWith("/tmp/receipt.png");
    expect(sendMessage).toHaveBeenCalledWith(
      "554299999999@c.us",
      mediaObject,
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: "receipt.png",
      lastMessageAt: expect.any(Number)
    });
    expect(userMessagesLogMock).toHaveBeenCalledWith({
      messageId: "message-123",
      userId: 99,
      ticketId: 10
    });
    expect(unlinkSyncMock).toHaveBeenCalledWith("/tmp/receipt.png");
    expect(startWhatsAppSessionVerifyMock).not.toHaveBeenCalled();
  });

  it("verifies the WhatsApp session when media sending fails", async () => {
    const sendError = new Error("session closed");
    const sendMessage = jest.fn().mockRejectedValue(sendError);
    const ticket = {
      id: 10,
      whatsappId: 20,
      isGroup: true,
      contact: {
        number: "554288888888"
      },
      update: jest.fn()
    };
    const media = {
      filename: "audio.ogg",
      path: "/tmp/audio.ogg"
    } as Express.Multer.File;

    getTicketWbotMock.mockResolvedValue({ sendMessage });
    messageMediaMock.mockReturnValue({ mimetype: "audio/ogg" });

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

    expect(startWhatsAppSessionVerifyMock).toHaveBeenCalledWith(20, sendError);
    expect(ticket.update).not.toHaveBeenCalled();
    expect(userMessagesLogMock).not.toHaveBeenCalled();
    expect(unlinkSyncMock).not.toHaveBeenCalled();
  });
});
