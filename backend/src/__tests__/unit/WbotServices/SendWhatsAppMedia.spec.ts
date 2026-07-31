import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import AppError from "../../../errors/AppError";
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

const mockGetTicketWbot = GetTicketWbot as jest.Mock;
const mockFromFilePath = MessageMedia.fromFilePath as jest.Mock;
const mockUserMessagesLogCreate = UserMessagesLog.create as jest.Mock;
const mockStartWhatsAppSessionVerify = StartWhatsAppSessionVerify as jest.Mock;
const mockLoggerError = logger.error as jest.Mock;
const mockUnlinkSync = fs.unlinkSync as jest.Mock;

describe("SendWhatsAppMedia", () => {
  const media = {
    path: "/tmp/audio.ogg",
    filename: "audio.ogg"
  } as Express.Multer.File;

  const buildTicket = () =>
    ({
      id: 123,
      whatsappId: 45,
      isGroup: false,
      contact: {
        number: "5599999999999"
      },
      update: jest.fn()
    } as any);

  beforeEach(() => {
    mockFromFilePath.mockReturnValue({ mimetype: "audio/ogg" });
  });

  it("sends media, updates ticket metadata and records the user message log", async () => {
    const ticket = buildTicket();
    const sendMessage = {
      id: {
        id: "message-id"
      }
    };
    const wbot = {
      sendMessage: jest.fn().mockResolvedValue(sendMessage)
    };

    mockGetTicketWbot.mockResolvedValue(wbot);

    const result = await SendWhatsAppMedia({
      media,
      ticket,
      userId: 77
    });

    expect(result).toBe(sendMessage);
    expect(mockFromFilePath).toHaveBeenCalledWith(media.path);
    expect(wbot.sendMessage).toHaveBeenCalledWith(
      "5599999999999@c.us",
      { mimetype: "audio/ogg" },
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: media.filename,
      lastMessageAt: expect.any(Number)
    });
    expect(mockUserMessagesLogCreate).toHaveBeenCalledWith({
      messageId: "message-id",
      userId: 77,
      ticketId: ticket.id
    });
    expect(mockUnlinkSync).toHaveBeenCalledWith(media.path);
  });

  it("verifies the WhatsApp session before surfacing send failures", async () => {
    const ticket = buildTicket();
    const sendError = new Error("Session closed");
    const wbot = {
      sendMessage: jest.fn().mockRejectedValue(sendError)
    };

    mockGetTicketWbot.mockResolvedValue(wbot);

    await expect(
      SendWhatsAppMedia({
        media,
        ticket,
        userId: undefined
      })
    ).rejects.toBeInstanceOf(AppError);

    expect(mockLoggerError).toHaveBeenCalledWith(
      `SendWhatsAppMedia | Error: ${sendError}`
    );
    expect(mockStartWhatsAppSessionVerify).toHaveBeenCalledWith(
      ticket.whatsappId,
      sendError
    );
    expect(ticket.update).not.toHaveBeenCalled();
    expect(mockUnlinkSync).not.toHaveBeenCalled();
  });
});

export {};
