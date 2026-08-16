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
import { logger } from "../../../utils/logger";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";

const mockedFromFilePath = MessageMedia.fromFilePath as jest.Mock;
const mockedGetTicketWbot = GetTicketWbot as jest.Mock;
const mockedUserMessagesLogCreate = UserMessagesLog.create as jest.Mock;
const mockedLoggerError = logger.error as jest.Mock;
const mockedStartWhatsAppSessionVerify = StartWhatsAppSessionVerify as jest.Mock;
const mockedUnlinkSync = fs.unlinkSync as jest.Mock;

const buildTicket = (overrides = {}) =>
  ({
    id: 42,
    whatsappId: 9,
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

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFromFilePath.mockReturnValue("media-content");
    mockedUserMessagesLogCreate.mockResolvedValue({});
  });

  it("sends media, updates the ticket and records the user message", async () => {
    const sendMessage = jest.fn().mockResolvedValue({ id: { id: "msg-1" } });
    mockedGetTicketWbot.mockResolvedValue({ sendMessage });
    const ticket = buildTicket();

    const result = await SendWhatsAppMedia({
      media,
      ticket,
      userId: 7
    });

    expect(mockedFromFilePath).toHaveBeenCalledWith("/tmp/audio.ogg");
    expect(sendMessage).toHaveBeenCalledWith(
      "5511999999999@c.us",
      "media-content",
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: "audio.ogg",
      lastMessageAt: expect.any(Number)
    });
    expect(mockedUserMessagesLogCreate).toHaveBeenCalledWith({
      messageId: "msg-1",
      userId: 7,
      ticketId: 42
    });
    expect(mockedUnlinkSync).toHaveBeenCalledWith("/tmp/audio.ogg");
    expect(result).toEqual({ id: { id: "msg-1" } });
  });

  it("verifies the WhatsApp session before surfacing media send failures", async () => {
    const error = new Error("session closed");
    const sendMessage = jest.fn().mockRejectedValue(error);
    mockedGetTicketWbot.mockResolvedValue({ sendMessage });
    const ticket = buildTicket();

    await expect(
      SendWhatsAppMedia({
        media,
        ticket,
        userId: 7
      })
    ).rejects.toBeInstanceOf(AppError);

    expect(mockedLoggerError).toHaveBeenCalledWith(
      `SendWhatsAppMedia | Error: ${error}`
    );
    expect(mockedStartWhatsAppSessionVerify).toHaveBeenCalledWith(
      9,
      error
    );
    expect(mockedUnlinkSync).not.toHaveBeenCalled();
  });
});
