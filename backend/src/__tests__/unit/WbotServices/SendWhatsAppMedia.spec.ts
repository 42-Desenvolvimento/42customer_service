/* eslint-disable import/first, @typescript-eslint/no-explicit-any */

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

const mockedGetTicketWbot = GetTicketWbot as jest.Mock;
const mockedMessageMedia = MessageMedia as jest.Mocked<typeof MessageMedia>;
const mockedUserMessagesLog = UserMessagesLog as jest.Mocked<
  typeof UserMessagesLog
>;
const mockedUnlinkSync = fs.unlinkSync as jest.Mock;
const mockedStartWhatsAppSessionVerify =
  StartWhatsAppSessionVerify as jest.Mock;

describe("SendWhatsAppMedia", () => {
  const media = {
    path: "/tmp/audio-message.ogg",
    filename: "audio-message.ogg"
  } as Express.Multer.File;

  const buildTicket = (overrides = {}) =>
    ({
      id: 321,
      tenantId: 7,
      whatsappId: 11,
      isGroup: false,
      contact: {
        number: "551188887777"
      },
      update: jest.fn().mockResolvedValue(undefined),
      ...overrides
    } as any);

  beforeEach(() => {
    mockedMessageMedia.fromFilePath.mockReturnValue({
      mimetype: "audio/ogg"
    } as any);
    mockedUserMessagesLog.create.mockResolvedValue({ id: 99 } as any);
  });

  it("sends media to the contact, logs the user message and removes the temp file", async () => {
    const sendMessageResult = { id: { id: "wbot-message-id" } } as any;
    const sendMessage = jest.fn().mockResolvedValue(sendMessageResult);
    const ticket = buildTicket();
    mockedGetTicketWbot.mockResolvedValue({ sendMessage });

    const result = await SendWhatsAppMedia({
      media,
      ticket,
      userId: 44
    });

    expect(mockedMessageMedia.fromFilePath).toHaveBeenCalledWith(media.path);
    expect(sendMessage).toHaveBeenCalledWith(
      "551188887777@c.us",
      { mimetype: "audio/ogg" },
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: media.filename,
      lastMessageAt: expect.any(Number)
    });
    expect(mockedUserMessagesLog.create).toHaveBeenCalledWith({
      messageId: sendMessageResult.id.id,
      userId: 44,
      ticketId: ticket.id
    });
    expect(mockedUnlinkSync).toHaveBeenCalledWith(media.path);
    expect(result).toBe(sendMessageResult);
  });

  it("verifies the WhatsApp session and raises AppError when media sending fails", async () => {
    const sendError = new Error("ERR_WAPP_NOT_INITIALIZED");
    const ticket = buildTicket();
    mockedGetTicketWbot.mockResolvedValue({
      sendMessage: jest.fn().mockRejectedValue(sendError)
    });

    await expect(
      SendWhatsAppMedia({
        media,
        ticket,
        userId: 44
      })
    ).rejects.toMatchObject({
      message: "ERR_SENDING_WAPP_MSG",
      statusCode: 400
    } as AppError);

    expect(mockedStartWhatsAppSessionVerify).toHaveBeenCalledWith(
      ticket.whatsappId,
      sendError
    );
    expect(mockedUnlinkSync).not.toHaveBeenCalled();
  });
});
