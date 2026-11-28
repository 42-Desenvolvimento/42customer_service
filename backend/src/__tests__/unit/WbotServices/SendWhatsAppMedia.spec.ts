import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import Ticket from "../../../models/Ticket";
import UserMessagesLog from "../../../models/UserMessagesLog";

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

jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn()
  }
}));

const getTicketWbotMock = GetTicketWbot as jest.Mock;
const fromFilePathMock = MessageMedia.fromFilePath as jest.Mock;
const unlinkSyncMock = fs.unlinkSync as jest.Mock;
const userMessagesLogCreateMock = UserMessagesLog.create as jest.Mock;
const startWhatsAppSessionVerifyMock = StartWhatsAppSessionVerify as jest.Mock;

const buildTicket = (): Ticket =>
  ({
    id: 12,
    whatsappId: 34,
    isGroup: false,
    contact: {
      number: "5511999999999"
    },
    update: jest.fn().mockResolvedValue(undefined)
  } as unknown as Ticket);

const buildMedia = (): Express.Multer.File =>
  ({
    path: "/tmp/audio.ogg",
    filename: "audio.ogg"
  } as Express.Multer.File);

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends media, updates ticket metadata, records user log, and removes the temp file", async () => {
    const ticket = buildTicket();
    const media = buildMedia();
    const mediaPayload = { mimetype: "audio/ogg" };
    const sentMessage = { id: { id: "message-id-1" } };
    const sendMessage = jest.fn().mockResolvedValue(sentMessage);

    getTicketWbotMock.mockResolvedValue({ sendMessage });
    fromFilePathMock.mockReturnValue(mediaPayload);

    const response = await SendWhatsAppMedia({
      media,
      ticket,
      userId: 99
    });

    expect(response).toBe(sentMessage);
    expect(fromFilePathMock).toHaveBeenCalledWith(media.path);
    expect(sendMessage).toHaveBeenCalledWith(
      "5511999999999@c.us",
      mediaPayload,
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: "audio.ogg",
      lastMessageAt: expect.any(Number)
    });
    expect(userMessagesLogCreateMock).toHaveBeenCalledWith({
      messageId: "message-id-1",
      userId: 99,
      ticketId: 12
    });
    expect(unlinkSyncMock).toHaveBeenCalledWith(media.path);
    expect(startWhatsAppSessionVerifyMock).not.toHaveBeenCalled();
  });

  it("starts session verification and raises the sending error when WhatsApp send fails", async () => {
    const ticket = buildTicket();
    const media = buildMedia();
    const sendError = new Error("session closed");
    const sendMessage = jest.fn().mockRejectedValue(sendError);

    getTicketWbotMock.mockResolvedValue({ sendMessage });
    fromFilePathMock.mockReturnValue({ mimetype: "audio/ogg" });

    await expect(
      SendWhatsAppMedia({
        media,
        ticket,
        userId: 99
      })
    ).rejects.toMatchObject({ message: "ERR_SENDING_WAPP_MSG" });

    expect(startWhatsAppSessionVerifyMock).toHaveBeenCalledWith(
      ticket.whatsappId,
      sendError
    );
    expect(ticket.update).not.toHaveBeenCalled();
    expect(userMessagesLogCreateMock).not.toHaveBeenCalled();
    expect(unlinkSyncMock).not.toHaveBeenCalled();
  });
});
