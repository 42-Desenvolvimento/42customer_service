import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import AppError from "../../../errors/AppError";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import UserMessagesLog from "../../../models/UserMessagesLog";

jest.mock("fs", () => ({
  unlinkSync: jest.fn()
}));

jest.mock("whatsapp-web.js", () => ({
  MessageMedia: {
    fromFilePath: jest.fn((path: string) => ({ path }))
  }
}));

jest.mock("../../../helpers/GetTicketWbot", () => jest.fn());

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

describe("SendWhatsAppMedia", () => {
  const media = {
    path: "/tmp/audio.ogg",
    filename: "audio.ogg"
  } as Express.Multer.File;

  const buildTicket = () =>
    ({
      id: 42,
      whatsappId: 9,
      isGroup: false,
      contact: {
        number: "5511999999999"
      },
      update: jest.fn().mockResolvedValue(undefined)
    } as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should send media, update the ticket, write the user log, and remove the temp file", async () => {
    const ticket = buildTicket();
    const sendMessage = {
      id: {
        id: "message-id"
      }
    };
    const wbot = {
      sendMessage: jest.fn().mockResolvedValue(sendMessage)
    };
    (GetTicketWbot as jest.Mock).mockResolvedValue(wbot);

    const result = await SendWhatsAppMedia({
      media,
      ticket,
      userId: 10
    });

    expect(MessageMedia.fromFilePath).toHaveBeenCalledWith(media.path);
    expect(wbot.sendMessage).toHaveBeenCalledWith(
      "5511999999999@c.us",
      { path: media.path },
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: media.filename,
      lastMessageAt: expect.any(Number)
    });
    expect(UserMessagesLog.create).toHaveBeenCalledWith({
      messageId: "message-id",
      userId: 10,
      ticketId: 42
    });
    expect(fs.unlinkSync).toHaveBeenCalledWith(media.path);
    expect(StartWhatsAppSessionVerify).not.toHaveBeenCalled();
    expect(result).toBe(sendMessage);
  });

  it("should verify the WhatsApp session and throw an app error when sending fails", async () => {
    const ticket = buildTicket();
    const sendError = new Error("Session closed");
    const wbot = {
      sendMessage: jest.fn().mockRejectedValue(sendError)
    };
    (GetTicketWbot as jest.Mock).mockResolvedValue(wbot);

    await expect(
      SendWhatsAppMedia({
        media,
        ticket,
        userId: undefined
      })
    ).rejects.toMatchObject<AppError>({
      message: "ERR_SENDING_WAPP_MSG",
      statusCode: 400
    });

    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(9, sendError);
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
});
