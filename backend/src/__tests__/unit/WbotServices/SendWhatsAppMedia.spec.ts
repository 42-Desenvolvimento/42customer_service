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

import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import UserMessagesLog from "../../../models/UserMessagesLog";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";

describe("SendWhatsAppMedia", () => {
  const media = {
    path: "/tmp/audio.ogg",
    filename: "audio.ogg"
  } as Express.Multer.File;

  const buildTicket = () =>
    ({
      id: 10,
      whatsappId: 7,
      isGroup: false,
      contact: {
        number: "5511999999999"
      },
      update: jest.fn().mockResolvedValue(undefined)
    } as any);

  it("sends media, updates the ticket and records the user message log", async () => {
    const ticket = buildTicket();
    const mediaPayload = { mimetype: "audio/ogg" };
    const sentMessage = { id: { id: "message-id" } };
    const sendMessage = jest.fn().mockResolvedValue(sentMessage);

    (MessageMedia.fromFilePath as jest.Mock).mockReturnValue(mediaPayload);
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendMessage });
    (UserMessagesLog.create as jest.Mock).mockResolvedValue({});

    await expect(
      SendWhatsAppMedia({ media, ticket, userId: 42 })
    ).resolves.toBe(sentMessage);

    expect(MessageMedia.fromFilePath).toHaveBeenCalledWith("/tmp/audio.ogg");
    expect(sendMessage).toHaveBeenCalledWith(
      "5511999999999@c.us",
      mediaPayload,
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: "audio.ogg",
      lastMessageAt: expect.any(Number)
    });
    expect(UserMessagesLog.create).toHaveBeenCalledWith({
      messageId: "message-id",
      userId: 42,
      ticketId: 10
    });
    expect(fs.unlinkSync).toHaveBeenCalledWith("/tmp/audio.ogg");
  });

  it("verifies the whatsapp session and throws AppError when media sending fails", async () => {
    const error = new Error("session disconnected");
    const ticket = buildTicket();

    (GetTicketWbot as jest.Mock).mockRejectedValue(error);

    await expect(
      SendWhatsAppMedia({ media, ticket, userId: 42 })
    ).rejects.toMatchObject({
      message: "ERR_SENDING_WAPP_MSG",
      statusCode: 400
    });

    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(7, error);
    expect(ticket.update).not.toHaveBeenCalled();
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
});
