import fs from "fs";
import AppError from "../../../errors/AppError";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import UserMessagesLog from "../../../models/UserMessagesLog";
import Ticket from "../../../models/Ticket";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { logger } from "../../../utils/logger";
import { MessageMedia } from "whatsapp-web.js";

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

const mockedGetTicketWbot = GetTicketWbot as jest.MockedFunction<
  typeof GetTicketWbot
>;
const mockedMessageMedia = MessageMedia as jest.Mocked<typeof MessageMedia>;
const mockedUserMessagesLog = UserMessagesLog as jest.Mocked<
  typeof UserMessagesLog
>;
const mockedStartWhatsAppSessionVerify =
  StartWhatsAppSessionVerify as jest.MockedFunction<
    typeof StartWhatsAppSessionVerify
  >;
const mockedLogger = logger as jest.Mocked<typeof logger>;
const mockedFs = fs as jest.Mocked<typeof fs>;

const buildTicket = (overrides: Partial<Ticket> = {}): Ticket =>
  ({
    id: 123,
    whatsappId: 456,
    isGroup: false,
    contact: {
      number: "5511999999999"
    },
    update: jest.fn(),
    ...overrides
  } as unknown as Ticket);

const buildMedia = (
  overrides: Partial<Express.Multer.File> = {}
): Express.Multer.File =>
  ({
    path: "/tmp/uploaded-media.ogg",
    filename: "uploaded-media.ogg",
    ...overrides
  } as Express.Multer.File);

describe("SendWhatsAppMedia", () => {
  const sendMessage = jest.fn();
  const mediaPayload = { mimetype: "audio/ogg" };
  const sentMessage = { id: { id: "wbot-message-id" } };

  beforeEach(() => {
    jest.clearAllMocks();

    mockedMessageMedia.fromFilePath.mockReturnValue(mediaPayload as any);
    mockedGetTicketWbot.mockResolvedValue({ sendMessage } as any);
    sendMessage.mockResolvedValue(sentMessage);
  });

  it("sends media to an individual contact, updates the ticket and records the user log", async () => {
    const ticket = buildTicket();
    const media = buildMedia();

    const result = await SendWhatsAppMedia({
      media,
      ticket,
      userId: "42"
    });

    expect(result).toBe(sentMessage);
    expect(mockedGetTicketWbot).toHaveBeenCalledWith(ticket);
    expect(mockedMessageMedia.fromFilePath).toHaveBeenCalledWith(media.path);
    expect(sendMessage).toHaveBeenCalledWith(
      "5511999999999@c.us",
      mediaPayload,
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: media.filename,
      lastMessageAt: expect.any(Number)
    });
    expect(mockedUserMessagesLog.create).toHaveBeenCalledWith({
      messageId: sentMessage.id.id,
      userId: "42",
      ticketId: ticket.id
    });
    expect(mockedFs.unlinkSync).toHaveBeenCalledWith(media.path);
    expect(mockedStartWhatsAppSessionVerify).not.toHaveBeenCalled();
  });

  it("uses the group WhatsApp suffix and skips user log when userId is not provided", async () => {
    const ticket = buildTicket({ isGroup: true });
    const media = buildMedia({ filename: "group-image.png" });

    await SendWhatsAppMedia({ media, ticket, userId: undefined });

    expect(sendMessage).toHaveBeenCalledWith(
      "5511999999999@g.us",
      mediaPayload,
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: media.filename,
      lastMessageAt: expect.any(Number)
    });
    expect(mockedUserMessagesLog.create).not.toHaveBeenCalled();
    expect(mockedFs.unlinkSync).toHaveBeenCalledWith(media.path);
  });

  it("checks whether the WhatsApp session must be recovered when media sending fails", async () => {
    const ticket = buildTicket();
    const media = buildMedia();
    const sendError = new Error("session closed");
    sendMessage.mockRejectedValue(sendError);

    await expect(
      SendWhatsAppMedia({
        media,
        ticket,
        userId: "42"
      })
    ).rejects.toMatchObject(new AppError("ERR_SENDING_WAPP_MSG"));

    expect(mockedLogger.error).toHaveBeenCalledWith(
      `SendWhatsAppMedia | Error: ${sendError}`
    );
    expect(mockedStartWhatsAppSessionVerify).toHaveBeenCalledWith(
      ticket.whatsappId,
      sendError
    );
    expect(mockedFs.unlinkSync).not.toHaveBeenCalled();
    expect(mockedUserMessagesLog.create).not.toHaveBeenCalled();
  });
});
