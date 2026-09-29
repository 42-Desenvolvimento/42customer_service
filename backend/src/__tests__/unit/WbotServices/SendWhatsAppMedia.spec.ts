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
import { logger } from "../../../utils/logger";

describe("SendWhatsAppMedia", () => {
  const media = {
    path: "/tmp/audio.ogg",
    filename: "audio.ogg"
  } as Express.Multer.File;

  const buildTicket = () =>
    ({
      id: 123,
      whatsappId: 456,
      isGroup: true,
      contact: {
        number: "5511888888888"
      },
      update: jest.fn().mockResolvedValue(undefined)
    } as any);

  beforeEach(() => {
    jest.clearAllMocks();
    (MessageMedia.fromFilePath as jest.Mock).mockReturnValue({
      mimetype: "audio/ogg"
    });
    (UserMessagesLog.create as jest.Mock).mockResolvedValue({});
  });

  it("sends media, updates the ticket, writes the user log, and removes the temporary file", async () => {
    const ticket = buildTicket();
    const sendMessageResponse = { id: { id: "wamid.123" } };
    const sendMessage = jest.fn().mockResolvedValue(sendMessageResponse);

    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendMessage });

    const result = await SendWhatsAppMedia({
      media,
      ticket,
      userId: 789
    });

    expect(result).toBe(sendMessageResponse);
    expect(MessageMedia.fromFilePath).toHaveBeenCalledWith(media.path);
    expect(sendMessage).toHaveBeenCalledWith(
      "5511888888888@g.us",
      { mimetype: "audio/ogg" },
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: media.filename,
      lastMessageAt: expect.any(Number)
    });
    expect(UserMessagesLog.create).toHaveBeenCalledWith({
      messageId: sendMessageResponse.id.id,
      userId: 789,
      ticketId: ticket.id
    });
    expect(fs.unlinkSync).toHaveBeenCalledWith(media.path);
  });

  it("verifies the WhatsApp session and throws a send error when media sending fails", async () => {
    const ticket = buildTicket();
    const sendError = new Error("disconnected");

    (GetTicketWbot as jest.Mock).mockRejectedValue(sendError);

    await expect(
      SendWhatsAppMedia({
        media,
        ticket,
        userId: 789
      })
    ).rejects.toMatchObject({
      message: "ERR_SENDING_WAPP_MSG"
    });

    expect(logger.error).toHaveBeenCalledWith(
      `SendWhatsAppMedia | Error: ${sendError}`
    );
    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(
      ticket.whatsappId,
      sendError
    );
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
});
