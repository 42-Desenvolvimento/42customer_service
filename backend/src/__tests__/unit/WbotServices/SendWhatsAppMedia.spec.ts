import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import AppError from "../../../errors/AppError";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import UserMessagesLog from "../../../models/UserMessagesLog";
import { logger } from "../../../utils/logger";

jest.mock("fs", () => ({
  unlinkSync: jest.fn()
}));

jest.mock("whatsapp-web.js", () => ({
  MessageMedia: {
    fromFilePath: jest.fn(path => ({ path }))
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
const unlinkSyncMock = fs.unlinkSync as unknown as jest.Mock;
const createUserMessagesLogMock = UserMessagesLog.create as jest.Mock;
const startWhatsAppSessionVerifyMock = StartWhatsAppSessionVerify as jest.Mock;
const loggerErrorMock = logger.error as jest.Mock;

const makeTicket = () =>
  ({
    id: 77,
    whatsappId: 10,
    isGroup: false,
    contact: {
      number: "5599999999999"
    },
    update: jest.fn()
  } as any);

const media = {
  path: "/tmp/audio.ogg",
  filename: "audio.ogg"
} as Express.Multer.File;

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should send media, update the ticket and remove the temporary file", async () => {
    const ticket = makeTicket();
    const sendMessage = {
      id: {
        id: "message-id"
      }
    };
    const sendMessageMock = jest.fn().mockResolvedValue(sendMessage);
    getTicketWbotMock.mockResolvedValue({
      sendMessage: sendMessageMock
    });

    const result = await SendWhatsAppMedia({
      media,
      ticket,
      userId: 5
    });

    expect(result).toBe(sendMessage);
    expect(fromFilePathMock).toHaveBeenCalledWith("/tmp/audio.ogg");
    expect(sendMessageMock).toHaveBeenCalledWith(
      "5599999999999@c.us",
      { path: "/tmp/audio.ogg" },
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: "audio.ogg",
      lastMessageAt: expect.any(Number)
    });
    expect(createUserMessagesLogMock).toHaveBeenCalledWith({
      messageId: "message-id",
      userId: 5,
      ticketId: 77
    });
    expect(unlinkSyncMock).toHaveBeenCalledWith("/tmp/audio.ogg");
    expect(startWhatsAppSessionVerifyMock).not.toHaveBeenCalled();
  });

  it("should verify the WhatsApp session when sending media fails", async () => {
    const ticket = makeTicket();
    const error = new Error("session closed");
    const sendMessageMock = jest.fn().mockRejectedValue(error);
    getTicketWbotMock.mockResolvedValue({
      sendMessage: sendMessageMock
    });

    await expect(
      SendWhatsAppMedia({
        media,
        ticket,
        userId: 5
      })
    ).rejects.toMatchObject(new AppError("ERR_SENDING_WAPP_MSG"));

    expect(startWhatsAppSessionVerifyMock).toHaveBeenCalledWith(10, error);
    expect(loggerErrorMock).toHaveBeenCalledWith(
      "SendWhatsAppMedia | Error: Error: session closed"
    );
    expect(ticket.update).not.toHaveBeenCalled();
    expect(createUserMessagesLogMock).not.toHaveBeenCalled();
    expect(unlinkSyncMock).not.toHaveBeenCalled();
  });
});
