const mockFromFilePath = jest.fn();
const mockGetTicketWbot = jest.fn();
const mockCreateUserMessagesLog = jest.fn();
const mockUnlinkSync = jest.fn();
const mockStartWhatsAppSessionVerify = jest.fn();

jest.mock("whatsapp-web.js", () => ({
  MessageMedia: {
    fromFilePath: mockFromFilePath
  }
}));

jest.mock("fs", () => ({
  unlinkSync: mockUnlinkSync
}));

jest.mock("../../../helpers/GetTicketWbot", () => mockGetTicketWbot);

jest.mock("../../../models/UserMessagesLog", () => ({
  create: mockCreateUserMessagesLog
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn()
  }
}));

jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: mockStartWhatsAppSessionVerify
}));

import AppError from "../../../errors/AppError";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";
import { logger } from "../../../utils/logger";

const buildTicket = () =>
  ({
    id: 99,
    whatsappId: 123,
    isGroup: false,
    contact: {
      number: "5511999999999"
    },
    update: jest.fn()
  } as any);

const buildMedia = () =>
  ({
    path: "/tmp/audio.ogg",
    filename: "audio.ogg"
  } as Express.Multer.File);

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFromFilePath.mockReturnValue({
      mimetype: "audio/ogg",
      data: "encoded"
    });
  });

  it("updates ticket, writes the user log and removes the local file after sending media", async () => {
    const sendMessage = {
      id: {
        id: "message-id"
      }
    };
    const wbot = {
      sendMessage: jest.fn().mockResolvedValue(sendMessage)
    };
    const ticket = buildTicket();
    mockGetTicketWbot.mockResolvedValue(wbot);

    const result = await SendWhatsAppMedia({
      media: buildMedia(),
      ticket,
      userId: 12
    });

    expect(mockFromFilePath).toHaveBeenCalledWith("/tmp/audio.ogg");
    expect(wbot.sendMessage).toHaveBeenCalledWith(
      "5511999999999@c.us",
      {
        mimetype: "audio/ogg",
        data: "encoded"
      },
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: "audio.ogg",
      lastMessageAt: expect.any(Number)
    });
    expect(mockCreateUserMessagesLog).toHaveBeenCalledWith({
      messageId: "message-id",
      userId: 12,
      ticketId: 99
    });
    expect(mockUnlinkSync).toHaveBeenCalledWith("/tmp/audio.ogg");
    expect(mockStartWhatsAppSessionVerify).not.toHaveBeenCalled();
    expect(result).toBe(sendMessage);
  });

  it("verifies the WhatsApp session before surfacing an AppError when media sending fails", async () => {
    const sendError = new Error("session closed");
    const wbot = {
      sendMessage: jest.fn().mockRejectedValue(sendError)
    };
    const ticket = buildTicket();
    mockGetTicketWbot.mockResolvedValue(wbot);

    await expect(
      SendWhatsAppMedia({
        media: buildMedia(),
        ticket,
        userId: 12
      })
    ).rejects.toMatchObject(new AppError("ERR_SENDING_WAPP_MSG"));

    expect(mockStartWhatsAppSessionVerify).toHaveBeenCalledWith(123, sendError);
    expect(logger.error).toHaveBeenCalledWith(
      `SendWhatsAppMedia | Error: ${sendError}`
    );
    expect(ticket.update).not.toHaveBeenCalled();
    expect(mockCreateUserMessagesLog).not.toHaveBeenCalled();
    expect(mockUnlinkSync).not.toHaveBeenCalled();
  });
});
