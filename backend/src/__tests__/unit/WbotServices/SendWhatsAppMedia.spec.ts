jest.mock("fs", () => {
  const unlinkSync = jest.fn();

  return {
    __esModule: true,
    default: {
      unlinkSync
    },
    unlinkSync
  };
});

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

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn()
  }
}));

jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));

import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import AppError from "../../../errors/AppError";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import UserMessagesLog from "../../../models/UserMessagesLog";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";

const fromFilePathMock = MessageMedia.fromFilePath as jest.Mock;
const getTicketWbotMock = GetTicketWbot as jest.Mock;
const createUserMessageLogMock = UserMessagesLog.create as jest.Mock;
const startSessionVerifyMock = StartWhatsAppSessionVerify as jest.Mock;
const unlinkSyncMock = fs.unlinkSync as jest.Mock;

const makeTicket = () => ({
  id: 20,
  whatsappId: 99,
  isGroup: false,
  contact: {
    number: "5511999999999"
  },
  update: jest.fn().mockResolvedValue(undefined)
});

const media = {
  path: "/tmp/audio.ogg",
  filename: "audio.ogg"
} as Express.Multer.File;

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fromFilePathMock.mockReturnValue({ mimetype: "audio/ogg" });
  });

  it("sends media, updates ticket metadata, logs the user action and removes the temp file", async () => {
    const ticket = makeTicket();
    const sentMessage = {
      id: {
        id: "message-id"
      }
    };
    const sendMessageMock = jest.fn().mockResolvedValue(sentMessage);
    getTicketWbotMock.mockResolvedValue({
      sendMessage: sendMessageMock
    });

    const result = await SendWhatsAppMedia({
      media,
      ticket: ticket as never,
      userId: 7
    });

    expect(result).toBe(sentMessage);
    expect(fromFilePathMock).toHaveBeenCalledWith("/tmp/audio.ogg");
    expect(sendMessageMock).toHaveBeenCalledWith(
      "5511999999999@c.us",
      { mimetype: "audio/ogg" },
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: "audio.ogg",
      lastMessageAt: expect.any(Number)
    });
    expect(createUserMessageLogMock).toHaveBeenCalledWith({
      messageId: "message-id",
      userId: 7,
      ticketId: 20
    });
    expect(unlinkSyncMock).toHaveBeenCalledWith("/tmp/audio.ogg");
  });

  it("verifies the WhatsApp session and throws AppError when media sending fails", async () => {
    const ticket = makeTicket();
    const error = new Error("session closed");
    const sendMessageMock = jest.fn().mockRejectedValue(error);
    getTicketWbotMock.mockResolvedValue({
      sendMessage: sendMessageMock
    });

    await expect(
      SendWhatsAppMedia({
        media,
        ticket: ticket as never,
        userId: 7
      })
    ).rejects.toMatchObject({
      message: "ERR_SENDING_WAPP_MSG",
      statusCode: 400
    } as AppError);

    expect(startSessionVerifyMock).toHaveBeenCalledWith(99, error);
    expect(ticket.update).not.toHaveBeenCalled();
    expect(createUserMessageLogMock).not.toHaveBeenCalled();
    expect(unlinkSyncMock).not.toHaveBeenCalled();
  });
});
