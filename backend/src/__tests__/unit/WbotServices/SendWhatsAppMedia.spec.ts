import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import UserMessagesLog from "../../../models/UserMessagesLog";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { logger } from "../../../utils/logger";

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

const mockedGetTicketWbot = GetTicketWbot as jest.Mock;
const mockedFromFilePath = MessageMedia.fromFilePath as jest.Mock;
const mockedUserMessagesLog = UserMessagesLog as unknown as {
  create: jest.Mock;
};
const mockedStartWhatsAppSessionVerify = StartWhatsAppSessionVerify as jest.Mock;
const mockedLogger = logger as unknown as {
  error: jest.Mock;
};

const makeMedia = () =>
  ({
    path: "/tmp/test-audio.ogg",
    filename: "test-audio.ogg"
  } as Express.Multer.File);

const makeTicket = (overrides = {}) =>
  ({
    id: 42,
    whatsappId: 7,
    isGroup: false,
    contact: {
      number: "5511999999999"
    },
    update: jest.fn().mockResolvedValue(undefined),
    ...overrides
  } as any);

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    mockedFromFilePath.mockReturnValue({ mimetype: "audio/ogg" });
    jest.spyOn(fs, "unlinkSync").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("sends the media, updates the ticket, logs the user message and removes the temporary file", async () => {
    const media = makeMedia();
    const ticket = makeTicket();
    const sendMessage = { id: { id: "message-id" } };
    const wbot = {
      sendMessage: jest.fn().mockResolvedValue(sendMessage)
    };
    mockedGetTicketWbot.mockResolvedValue(wbot);

    await expect(
      SendWhatsAppMedia({ media, ticket, userId: "99" })
    ).resolves.toBe(sendMessage);

    expect(mockedGetTicketWbot).toHaveBeenCalledWith(ticket);
    expect(mockedFromFilePath).toHaveBeenCalledWith(media.path);
    expect(wbot.sendMessage).toHaveBeenCalledWith(
      "5511999999999@c.us",
      { mimetype: "audio/ogg" },
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: media.filename,
      lastMessageAt: expect.any(Number)
    });
    expect(mockedUserMessagesLog.create).toHaveBeenCalledWith({
      messageId: "message-id",
      userId: "99",
      ticketId: ticket.id
    });
    expect(fs.unlinkSync).toHaveBeenCalledWith(media.path);
    expect(mockedStartWhatsAppSessionVerify).not.toHaveBeenCalled();
    expect(mockedLogger.error).not.toHaveBeenCalled();
  });

  it("keeps the sent message successful when user message logging fails", async () => {
    const media = makeMedia();
    const ticket = makeTicket({ isGroup: true });
    const sendMessage = { id: { id: "group-message-id" } };
    const wbot = {
      sendMessage: jest.fn().mockResolvedValue(sendMessage)
    };
    const logError = new Error("log database unavailable");
    mockedGetTicketWbot.mockResolvedValue(wbot);
    mockedUserMessagesLog.create.mockRejectedValue(logError);

    await expect(
      SendWhatsAppMedia({ media, ticket, userId: 123 })
    ).resolves.toBe(sendMessage);

    expect(wbot.sendMessage).toHaveBeenCalledWith(
      "5511999999999@g.us",
      { mimetype: "audio/ogg" },
      { sendAudioAsVoice: true }
    );
    expect(mockedLogger.error).toHaveBeenCalledWith(
      `Error criar log mensagem ${logError}`
    );
    expect(fs.unlinkSync).toHaveBeenCalledWith(media.path);
    expect(mockedStartWhatsAppSessionVerify).not.toHaveBeenCalled();
  });

  it("verifies the WhatsApp session and wraps the error when sending fails", async () => {
    const media = makeMedia();
    const ticket = makeTicket();
    const originalError = new Error("socket disconnected");
    const wbot = {
      sendMessage: jest.fn().mockRejectedValue(originalError)
    };
    mockedGetTicketWbot.mockResolvedValue(wbot);

    await expect(
      SendWhatsAppMedia({ media, ticket, userId: "99" })
    ).rejects.toMatchObject({
      message: "ERR_SENDING_WAPP_MSG",
      statusCode: 400
    });

    expect(mockedStartWhatsAppSessionVerify).toHaveBeenCalledWith(
      ticket.whatsappId,
      originalError
    );
    expect(mockedLogger.error).toHaveBeenCalledWith(
      `SendWhatsAppMedia | Error: ${originalError}`
    );
    expect(ticket.update).not.toHaveBeenCalled();
    expect(mockedUserMessagesLog.create).not.toHaveBeenCalled();
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
});
