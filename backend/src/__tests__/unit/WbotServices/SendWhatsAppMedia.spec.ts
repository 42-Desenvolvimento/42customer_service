jest.mock("fs", () => ({
  unlinkSync: jest.fn()
}));

jest.mock("whatsapp-web.js", () => ({
  MessageMedia: {
    fromFilePath: jest.fn(() => ({ mockedMedia: true }))
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
import { logger } from "../../../utils/logger";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const makeTicket = () =>
    ({
      id: 12,
      whatsappId: 34,
      isGroup: false,
      contact: {
        number: "5511999999999"
      },
      update: jest.fn().mockResolvedValue(undefined)
    } as any);

  const makeMedia = () =>
    ({
      path: "/tmp/test-file.ogg",
      filename: "test-file.ogg"
    } as Express.Multer.File);

  it("updates ticket, logs sender and removes the local file after sending media", async () => {
    const ticket = makeTicket();
    const sendMessageResult = {
      id: {
        id: "wbot-message-id"
      }
    };
    const sendMessage = jest.fn().mockResolvedValue(sendMessageResult);
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendMessage });

    await expect(
      SendWhatsAppMedia({
        media: makeMedia(),
        ticket,
        userId: 99
      })
    ).resolves.toBe(sendMessageResult);

    expect(MessageMedia.fromFilePath).toHaveBeenCalledWith("/tmp/test-file.ogg");
    expect(sendMessage).toHaveBeenCalledWith(
      "5511999999999@c.us",
      { mockedMedia: true },
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: "test-file.ogg",
      lastMessageAt: expect.any(Number)
    });
    expect(UserMessagesLog.create).toHaveBeenCalledWith({
      messageId: "wbot-message-id",
      userId: 99,
      ticketId: 12
    });
    expect(fs.unlinkSync).toHaveBeenCalledWith("/tmp/test-file.ogg");
    expect(StartWhatsAppSessionVerify).not.toHaveBeenCalled();
  });

  it("verifies the whatsapp session before returning an app error when sending fails", async () => {
    const ticket = makeTicket();
    const sendError = new Error("session closed");
    const sendMessage = jest.fn().mockRejectedValue(sendError);
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendMessage });

    await expect(
      SendWhatsAppMedia({
        media: makeMedia(),
        ticket,
        userId: 99
      })
    ).rejects.toMatchObject({
      message: "ERR_SENDING_WAPP_MSG",
      statusCode: 400
    });

    expect(logger.error).toHaveBeenCalledWith(
      `SendWhatsAppMedia | Error: ${sendError}`
    );
    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(34, sendError);
    expect(UserMessagesLog.create).not.toHaveBeenCalled();
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
});

export {};
