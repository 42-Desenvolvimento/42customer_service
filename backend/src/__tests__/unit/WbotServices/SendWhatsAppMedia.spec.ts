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
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { logger } from "../../../utils/logger";

const getTicketWbotMock = GetTicketWbot as jest.Mock;
const fromFilePathMock = MessageMedia.fromFilePath as jest.Mock;
const createUserMessagesLogMock = UserMessagesLog.create as jest.Mock;
const unlinkSyncMock = fs.unlinkSync as jest.Mock;
const startWhatsAppSessionVerifyMock = StartWhatsAppSessionVerify as jest.Mock;
const loggerErrorMock = logger.error as jest.Mock;

const makeTicket = () =>
  ({
    id: 10,
    whatsappId: 55,
    isGroup: false,
    contact: {
      number: "5511999999999"
    },
    update: jest.fn().mockResolvedValue(undefined)
  } as any);

const media = {
  path: "/tmp/audio.ogg",
  filename: "audio.ogg"
} as Express.Multer.File;

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends media, updates the ticket, logs the user message and removes the file", async () => {
    const ticket = makeTicket();
    const sendMessage = jest.fn().mockResolvedValue({
      id: {
        id: "message-id"
      }
    });
    const mediaPayload = { mimetype: "audio/ogg" };
    getTicketWbotMock.mockResolvedValue({ sendMessage });
    fromFilePathMock.mockReturnValue(mediaPayload);

    const result = await SendWhatsAppMedia({
      media,
      ticket,
      userId: 99
    });

    expect(fromFilePathMock).toHaveBeenCalledWith("/tmp/audio.ogg");
    expect(sendMessage).toHaveBeenCalledWith(
      "5511999999999@c.us",
      mediaPayload,
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: "audio.ogg",
      lastMessageAt: expect.any(Number)
    });
    expect(createUserMessagesLogMock).toHaveBeenCalledWith({
      messageId: "message-id",
      userId: 99,
      ticketId: 10
    });
    expect(unlinkSyncMock).toHaveBeenCalledWith("/tmp/audio.ogg");
    expect(result).toEqual({
      id: {
        id: "message-id"
      }
    });
  });

  it("verifies the WhatsApp session before throwing when media send fails", async () => {
    const ticket = makeTicket();
    const error = new Error("session closed");
    getTicketWbotMock.mockRejectedValue(error);

    await expect(
      SendWhatsAppMedia({
        media,
        ticket,
        userId: 99
      })
    ).rejects.toMatchObject(new AppError("ERR_SENDING_WAPP_MSG"));

    expect(loggerErrorMock).toHaveBeenCalledWith(
      `SendWhatsAppMedia | Error: ${error}`
    );
    expect(startWhatsAppSessionVerifyMock).toHaveBeenCalledWith(55, error);
    expect(ticket.update).not.toHaveBeenCalled();
    expect(unlinkSyncMock).not.toHaveBeenCalled();
  });
});
