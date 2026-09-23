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

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
  }
}));

jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));

import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import UserMessagesLog from "../../../models/UserMessagesLog";
import { logger } from "../../../utils/logger";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (MessageMedia.fromFilePath as jest.Mock).mockReturnValue({
      mimetype: "image/png",
      data: "base64"
    });
  });

  it("updates the ticket, logs the user message and removes the file after sending", async () => {
    const sendMessage = {
      id: {
        id: "message-id"
      }
    };
    const wbot = {
      sendMessage: jest.fn().mockResolvedValue(sendMessage)
    };
    (GetTicketWbot as jest.Mock).mockResolvedValue(wbot);
    const ticket = {
      id: 12,
      whatsappId: 4,
      isGroup: true,
      contact: {
        number: "5511888888888"
      },
      update: jest.fn().mockResolvedValue(undefined)
    };
    const media = {
      path: "/tmp/uploaded-file.png",
      filename: "uploaded-file.png"
    };

    await expect(
      SendWhatsAppMedia({ media: media as any, ticket: ticket as any, userId: 99 })
    ).resolves.toBe(sendMessage);

    expect(MessageMedia.fromFilePath).toHaveBeenCalledWith("/tmp/uploaded-file.png");
    expect(wbot.sendMessage).toHaveBeenCalledWith(
      "5511888888888@g.us",
      { mimetype: "image/png", data: "base64" },
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: "uploaded-file.png",
      lastMessageAt: expect.any(Number)
    });
    expect(UserMessagesLog.create).toHaveBeenCalledWith({
      messageId: "message-id",
      userId: 99,
      ticketId: 12
    });
    expect(fs.unlinkSync).toHaveBeenCalledWith("/tmp/uploaded-file.png");
  });

  it("revalidates the WhatsApp session and throws an AppError when sending fails", async () => {
    const sendError = new Error("Session closed");
    const wbot = {
      sendMessage: jest.fn().mockRejectedValue(sendError)
    };
    (GetTicketWbot as jest.Mock).mockResolvedValue(wbot);
    const ticket = {
      id: 12,
      whatsappId: 4,
      isGroup: false,
      contact: {
        number: "5511888888888"
      },
      update: jest.fn()
    };
    const media = {
      path: "/tmp/uploaded-file.png",
      filename: "uploaded-file.png"
    };

    await expect(
      SendWhatsAppMedia({ media: media as any, ticket: ticket as any, userId: 99 })
    ).rejects.toMatchObject({
      message: "ERR_SENDING_WAPP_MSG",
      statusCode: 400
    });

    expect(logger.error).toHaveBeenCalledWith(`SendWhatsAppMedia | Error: ${sendError}`);
    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(4, sendError);
    expect(ticket.update).not.toHaveBeenCalled();
    expect(UserMessagesLog.create).not.toHaveBeenCalled();
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
});
