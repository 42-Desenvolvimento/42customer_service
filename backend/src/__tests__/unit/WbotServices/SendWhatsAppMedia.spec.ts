jest.mock("fs", () => ({ unlinkSync: jest.fn() }));
jest.mock("whatsapp-web.js", () => ({
  MessageMedia: {
    fromFilePath: jest.fn()
  }
}));
jest.mock("../../../helpers/GetTicketWbot", () => jest.fn());
jest.mock("../../../models/UserMessagesLog", () => ({ create: jest.fn() }));
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
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

describe("SendWhatsAppMedia", () => {
  const makeTicket = () =>
    ({
      id: 10,
      whatsappId: 5,
      isGroup: false,
      contact: {
        number: "5511999999999"
      },
      update: jest.fn().mockResolvedValue(undefined)
    } as any);

  const media = {
    path: "/tmp/media.png",
    filename: "media.png"
  } as Express.Multer.File;

  beforeEach(() => {
    jest.clearAllMocks();
    (MessageMedia.fromFilePath as jest.Mock).mockReturnValue("message-media");
  });

  it("sends media, updates ticket metadata, logs the user message and removes the temp file", async () => {
    const ticket = makeTicket();
    const sendMessage = {
      id: {
        id: "message-id"
      }
    };
    const sendMessageMock = jest.fn().mockResolvedValue(sendMessage);
    (GetTicketWbot as jest.Mock).mockResolvedValue({
      sendMessage: sendMessageMock
    });

    await expect(
      SendWhatsAppMedia({ media, ticket, userId: 99 })
    ).resolves.toBe(sendMessage);

    expect(MessageMedia.fromFilePath).toHaveBeenCalledWith(media.path);
    expect(sendMessageMock).toHaveBeenCalledWith(
      "5511999999999@c.us",
      "message-media",
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: media.filename,
      lastMessageAt: expect.any(Number)
    });
    expect(UserMessagesLog.create).toHaveBeenCalledWith({
      messageId: "message-id",
      userId: 99,
      ticketId: ticket.id
    });
    expect(fs.unlinkSync).toHaveBeenCalledWith(media.path);
    expect(StartWhatsAppSessionVerify).not.toHaveBeenCalled();
  });

  it("verifies the WhatsApp session when sending media fails", async () => {
    const ticket = makeTicket();
    const error = new Error("session closed");
    (GetTicketWbot as jest.Mock).mockResolvedValue({
      sendMessage: jest.fn().mockRejectedValue(error)
    });

    await expect(
      SendWhatsAppMedia({ media, ticket, userId: 99 })
    ).rejects.toMatchObject({
      message: "ERR_SENDING_WAPP_MSG",
      statusCode: 400
    });

    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(
      ticket.whatsappId,
      error
    );
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
});
