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
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import UserMessagesLog from "../../../models/UserMessagesLog";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";

describe("SendWhatsAppMedia", () => {
  const unlinkSyncMock = fs.unlinkSync as jest.Mock;
  const fromFilePathMock = MessageMedia.fromFilePath as jest.Mock;
  const getTicketWbotMock = GetTicketWbot as jest.Mock;
  const userMessagesLogCreateMock = UserMessagesLog.create as jest.Mock;
  const startWhatsAppSessionVerifyMock = StartWhatsAppSessionVerify as jest.Mock;

  const media = {
    filename: "document.pdf",
    path: "/tmp/document.pdf"
  };

  const createTicket = () => ({
    id: 12,
    whatsappId: 34,
    isGroup: false,
    contact: {
      number: "5511888888888"
    },
    update: jest.fn().mockResolvedValue(undefined)
  });

  beforeEach(() => {
    jest.clearAllMocks();
    fromFilePathMock.mockReturnValue({ mimetype: "application/pdf" });
    userMessagesLogCreateMock.mockResolvedValue(undefined);
  });

  it("sends media, updates the ticket and records the user message log", async () => {
    const sendMessage = {
      id: {
        id: "message-id"
      }
    };
    const sendMessageMock = jest.fn().mockResolvedValue(sendMessage);
    const ticket = createTicket();

    getTicketWbotMock.mockResolvedValue({ sendMessage: sendMessageMock });

    await expect(
      SendWhatsAppMedia({
        media: media as Express.Multer.File,
        ticket: ticket as any,
        userId: 99
      })
    ).resolves.toBe(sendMessage);

    expect(fromFilePathMock).toHaveBeenCalledWith(media.path);
    expect(sendMessageMock).toHaveBeenCalledWith(
      "5511888888888@c.us",
      { mimetype: "application/pdf" },
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: media.filename,
      lastMessageAt: expect.any(Number)
    });
    expect(userMessagesLogCreateMock).toHaveBeenCalledWith({
      messageId: "message-id",
      userId: 99,
      ticketId: ticket.id
    });
    expect(unlinkSyncMock).toHaveBeenCalledWith(media.path);
  });

  it("verifies the whatsapp session before wrapping send failures", async () => {
    const sendError = new Error("Cannot read property sendMessage of undefined");
    const sendMessageMock = jest.fn().mockRejectedValue(sendError);
    const ticket = createTicket();

    getTicketWbotMock.mockResolvedValue({ sendMessage: sendMessageMock });

    await expect(
      SendWhatsAppMedia({
        media: media as Express.Multer.File,
        ticket: ticket as any,
        userId: undefined
      })
    ).rejects.toMatchObject({
      message: "ERR_SENDING_WAPP_MSG"
    });

    expect(startWhatsAppSessionVerifyMock).toHaveBeenCalledWith(
      ticket.whatsappId,
      sendError
    );
    expect(ticket.update).not.toHaveBeenCalled();
    expect(userMessagesLogCreateMock).not.toHaveBeenCalled();
    expect(unlinkSyncMock).not.toHaveBeenCalled();
  });
});

export {};
