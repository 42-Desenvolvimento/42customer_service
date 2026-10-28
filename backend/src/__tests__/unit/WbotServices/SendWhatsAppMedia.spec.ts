import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
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

const makeTicket = () =>
  ({
    id: 10,
    whatsappId: 55,
    isGroup: false,
    contact: {
      number: "5511999999999"
    },
    update: jest.fn()
  } as any);

const makeMedia = () =>
  ({
    path: "/tmp/uploaded-file.png",
    filename: "uploaded-file.png"
  } as Express.Multer.File);

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends media, updates the ticket and records the user message log", async () => {
    const ticket = makeTicket();
    const media = makeMedia();
    const parsedMedia = { mimetype: "image/png" };
    const sentMessage = { id: { id: "message-1" } };
    const sendMessage = jest.fn().mockResolvedValue(sentMessage);

    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendMessage });
    (MessageMedia.fromFilePath as jest.Mock).mockReturnValue(parsedMedia);

    await expect(
      SendWhatsAppMedia({ media, ticket, userId: 42 })
    ).resolves.toBe(sentMessage);

    expect(MessageMedia.fromFilePath).toHaveBeenCalledWith(media.path);
    expect(sendMessage).toHaveBeenCalledWith(
      "5511999999999@c.us",
      parsedMedia,
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: media.filename,
      lastMessageAt: expect.any(Number)
    });
    expect(UserMessagesLog.create).toHaveBeenCalledWith({
      messageId: "message-1",
      userId: 42,
      ticketId: ticket.id
    });
    expect(fs.unlinkSync).toHaveBeenCalledWith(media.path);
  });

  it("verifies the WhatsApp session before returning a sending error", async () => {
    const ticket = makeTicket();
    const media = makeMedia();
    const error = new Error("session closed");

    (GetTicketWbot as jest.Mock).mockRejectedValue(error);

    await expect(
      SendWhatsAppMedia({ media, ticket, userId: 42 })
    ).rejects.toMatchObject({ message: "ERR_SENDING_WAPP_MSG" });

    expect(logger.error).toHaveBeenCalledWith(
      `SendWhatsAppMedia | Error: ${error}`
    );
    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(
      ticket.whatsappId,
      error
    );
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
});
