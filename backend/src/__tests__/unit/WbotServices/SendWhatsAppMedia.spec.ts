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

describe("SendWhatsAppMedia", () => {
  const mockedFs = fs as jest.Mocked<typeof fs>;
  const mockedMessageMedia = MessageMedia as jest.Mocked<typeof MessageMedia>;
  const mockedGetTicketWbot = GetTicketWbot as jest.Mock;
  const mockedUserMessagesLog = UserMessagesLog as unknown as {
    create: jest.Mock;
  };
  const mockedStartWhatsAppSessionVerify =
    StartWhatsAppSessionVerify as jest.Mock;
  const mockedLogger = logger as jest.Mocked<typeof logger>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const makeTicket = (overrides = {}) =>
    ({
      id: 123,
      whatsappId: 30,
      isGroup: false,
      contact: {
        number: "5511999999999"
      },
      update: jest.fn().mockResolvedValue(undefined),
      ...overrides
    } as any);

  const media = {
    path: "/tmp/audio.ogg",
    filename: "audio.ogg"
  } as Express.Multer.File;

  it("should send media, update ticket and register the user message log", async () => {
    const ticket = makeTicket();
    const newMedia = { mimetype: "audio/ogg" };
    const sentMessage = {
      id: {
        id: "message-id"
      }
    };
    const sendMessage = jest.fn().mockResolvedValue(sentMessage);
    mockedMessageMedia.fromFilePath.mockReturnValue(newMedia as any);
    mockedGetTicketWbot.mockResolvedValue({ sendMessage });

    const result = await SendWhatsAppMedia({
      media,
      ticket,
      userId: 10
    });

    expect(result).toBe(sentMessage);
    expect(mockedMessageMedia.fromFilePath).toHaveBeenCalledWith(media.path);
    expect(sendMessage).toHaveBeenCalledWith("5511999999999@c.us", newMedia, {
      sendAudioAsVoice: true
    });
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: "audio.ogg",
      lastMessageAt: expect.any(Number)
    });
    expect(mockedUserMessagesLog.create).toHaveBeenCalledWith({
      messageId: "message-id",
      userId: 10,
      ticketId: 123
    });
    expect(mockedFs.unlinkSync).toHaveBeenCalledWith(media.path);
  });

  it("should not create user message log when userId is missing", async () => {
    const ticket = makeTicket({ isGroup: true });
    const sentMessage = {
      id: {
        id: "message-id"
      }
    };
    const sendMessage = jest.fn().mockResolvedValue(sentMessage);
    mockedMessageMedia.fromFilePath.mockReturnValue({} as any);
    mockedGetTicketWbot.mockResolvedValue({ sendMessage });

    await SendWhatsAppMedia({
      media,
      ticket,
      userId: undefined
    });

    expect(sendMessage).toHaveBeenCalledWith(
      "5511999999999@g.us",
      expect.anything(),
      {
        sendAudioAsVoice: true
      }
    );
    expect(mockedUserMessagesLog.create).not.toHaveBeenCalled();
  });

  it("should keep sending media when user message log creation fails", async () => {
    const logError = new Error("database unavailable");
    const sentMessage = {
      id: {
        id: "message-id"
      }
    };
    mockedMessageMedia.fromFilePath.mockReturnValue({} as any);
    mockedGetTicketWbot.mockResolvedValue({
      sendMessage: jest.fn().mockResolvedValue(sentMessage)
    });
    mockedUserMessagesLog.create.mockRejectedValue(logError);

    const result = await SendWhatsAppMedia({
      media,
      ticket: makeTicket(),
      userId: 10
    });

    expect(result).toBe(sentMessage);
    expect(mockedLogger.error).toHaveBeenCalledWith(
      `Error criar log mensagem ${logError}`
    );
    expect(mockedFs.unlinkSync).toHaveBeenCalledWith(media.path);
  });

  it("should verify whatsapp session and throw app error when send fails", async () => {
    const sendError = new Error("session closed");
    const ticket = makeTicket();
    mockedMessageMedia.fromFilePath.mockReturnValue({} as any);
    mockedGetTicketWbot.mockResolvedValue({
      sendMessage: jest.fn().mockRejectedValue(sendError)
    });

    await expect(
      SendWhatsAppMedia({
        media,
        ticket,
        userId: 10
      })
    ).rejects.toMatchObject(new AppError("ERR_SENDING_WAPP_MSG"));

    expect(mockedLogger.error).toHaveBeenCalledWith(
      `SendWhatsAppMedia | Error: ${sendError}`
    );
    expect(mockedStartWhatsAppSessionVerify).toHaveBeenCalledWith(
      30,
      sendError
    );
  });
});
