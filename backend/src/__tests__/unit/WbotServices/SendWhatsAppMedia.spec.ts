import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import AppError from "../../../errors/AppError";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import UserMessagesLog from "../../../models/UserMessagesLog";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

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

const mockGetTicketWbot = GetTicketWbot as jest.Mock;
const mockFromFilePath = MessageMedia.fromFilePath as jest.Mock;
const mockUnlinkSync = fs.unlinkSync as jest.Mock;
const mockUserMessagesLogCreate = UserMessagesLog.create as jest.Mock;
const mockStartWhatsAppSessionVerify = StartWhatsAppSessionVerify as jest.Mock;

describe("SendWhatsAppMedia", () => {
  const media = {
    path: "/tmp/audio.ogg",
    filename: "audio.ogg"
  } as Express.Multer.File;

  const buildTicket = () =>
    ({
      id: 123,
      whatsappId: 10,
      isGroup: false,
      contact: {
        number: "5511999999999"
      },
      update: jest.fn()
    } as any);

  beforeEach(() => {
    jest.clearAllMocks();
    mockFromFilePath.mockReturnValue({ mimetype: "audio/ogg" });
  });

  it("sends media, updates the ticket and records the user message log", async () => {
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
      userId: 42
    });

    expect(result).toBe(sendMessage);
    expect(mockFromFilePath).toHaveBeenCalledWith(media.path);
    expect(wbot.sendMessage).toHaveBeenCalledWith(
      "5511999999999@c.us",
      { mimetype: "audio/ogg" },
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: media.filename,
      lastMessageAt: expect.any(Number)
    });
    expect(mockUserMessagesLogCreate).toHaveBeenCalledWith({
      messageId: "message-id",
      userId: 42,
      ticketId: 123
    });
    expect(mockUnlinkSync).toHaveBeenCalledWith(media.path);
  });

  it("verifies the whatsapp session and throws the send error when media sending fails", async () => {
    const ticket = buildTicket();
    const sendError = new Error("wbot disconnected");
    const wbot = {
      sendMessage: jest.fn().mockRejectedValue(sendError)
    };
    mockGetTicketWbot.mockResolvedValue(wbot);

    await expect(
      SendWhatsAppMedia({
        media,
        ticket,
        userId: 42
      })
    ).rejects.toMatchObject<AppError>({
      message: "ERR_SENDING_WAPP_MSG",
      statusCode: 400
    });

    expect(mockStartWhatsAppSessionVerify).toHaveBeenCalledWith(10, sendError);
    expect(ticket.update).not.toHaveBeenCalled();
    expect(mockUserMessagesLogCreate).not.toHaveBeenCalled();
    expect(mockUnlinkSync).not.toHaveBeenCalled();
  });
});
