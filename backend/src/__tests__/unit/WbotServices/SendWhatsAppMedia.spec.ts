const mockUnlinkSync = jest.fn();
const mockFromFilePath = jest.fn();
const mockGetTicketWbot = jest.fn();
const mockUserMessagesLogCreate = jest.fn();
const mockLoggerError = jest.fn();
const mockStartWhatsAppSessionVerify = jest.fn();

jest.mock("fs", () => ({
  unlinkSync: mockUnlinkSync
}));

jest.mock("whatsapp-web.js", () => ({
  MessageMedia: {
    fromFilePath: mockFromFilePath
  }
}));

jest.mock("../../../helpers/GetTicketWbot", () => mockGetTicketWbot);

jest.mock("../../../models/UserMessagesLog", () => ({
  create: mockUserMessagesLogCreate
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: mockLoggerError
  }
}));

jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: mockStartWhatsAppSessionVerify
}));

import AppError from "../../../errors/AppError";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";

const buildTicket = (overrides = {}) =>
  ({
    id: 123,
    whatsappId: 456,
    isGroup: false,
    contact: {
      number: "5511999999999"
    },
    update: jest.fn().mockResolvedValue(undefined),
    ...overrides
  } as any);

const buildMedia = (overrides = {}) =>
  ({
    path: "/tmp/uploaded-audio.ogg",
    filename: "uploaded-audio.ogg",
    ...overrides
  } as Express.Multer.File);

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFromFilePath.mockReturnValue({ mimetype: "audio/ogg", data: "media" });
    mockUserMessagesLogCreate.mockResolvedValue(undefined);
  });

  it("sends media, updates ticket, logs the user message and removes the local file", async () => {
    const ticket = buildTicket();
    const media = buildMedia();
    const sentMessage = { id: { id: "wbot-message-id" } };
    const sendMessage = jest.fn().mockResolvedValue(sentMessage);

    mockGetTicketWbot.mockResolvedValue({ sendMessage });

    const result = await SendWhatsAppMedia({
      media,
      ticket,
      userId: 789
    });

    expect(mockGetTicketWbot).toHaveBeenCalledWith(ticket);
    expect(mockFromFilePath).toHaveBeenCalledWith(media.path);
    expect(sendMessage).toHaveBeenCalledWith(
      "5511999999999@c.us",
      { mimetype: "audio/ogg", data: "media" },
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: media.filename,
      lastMessageAt: expect.any(Number)
    });
    expect(mockUserMessagesLogCreate).toHaveBeenCalledWith({
      messageId: sentMessage.id.id,
      userId: 789,
      ticketId: ticket.id
    });
    expect(mockUnlinkSync).toHaveBeenCalledWith(media.path);
    expect(result).toBe(sentMessage);
  });

  it("keeps the sent media result when user message logging fails", async () => {
    const ticket = buildTicket({ isGroup: true });
    const media = buildMedia({
      path: "/tmp/group-image.png",
      filename: "group-image.png"
    });
    const sentMessage = { id: { id: "group-message-id" } };
    const sendMessage = jest.fn().mockResolvedValue(sentMessage);
    const logError = new Error("log database unavailable");

    mockGetTicketWbot.mockResolvedValue({ sendMessage });
    mockUserMessagesLogCreate.mockRejectedValue(logError);

    const result = await SendWhatsAppMedia({
      media,
      ticket,
      userId: "agent-1"
    });

    expect(sendMessage).toHaveBeenCalledWith(
      "5511999999999@g.us",
      { mimetype: "audio/ogg", data: "media" },
      { sendAudioAsVoice: true }
    );
    expect(mockLoggerError).toHaveBeenCalledWith(
      `Error criar log mensagem ${logError}`
    );
    expect(mockUnlinkSync).toHaveBeenCalledWith(media.path);
    expect(result).toBe(sentMessage);
  });

  it("verifies the whatsapp session and throws an AppError when sending fails", async () => {
    const ticket = buildTicket();
    const media = buildMedia();
    const sendError = new Error("disconnected session");
    const sendMessage = jest.fn().mockRejectedValue(sendError);

    mockGetTicketWbot.mockResolvedValue({ sendMessage });

    const promise = SendWhatsAppMedia({
      media,
      ticket,
      userId: 789
    });

    await expect(promise).rejects.toBeInstanceOf(AppError);
    await expect(promise).rejects.toMatchObject({
      message: "ERR_SENDING_WAPP_MSG",
      statusCode: 400
    });

    expect(mockStartWhatsAppSessionVerify).toHaveBeenCalledWith(
      ticket.whatsappId,
      sendError
    );
    expect(ticket.update).not.toHaveBeenCalled();
    expect(mockUserMessagesLogCreate).not.toHaveBeenCalled();
    expect(mockUnlinkSync).not.toHaveBeenCalled();
  });
});

export {};
