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

const mockedGetTicketWbot = GetTicketWbot as jest.Mock;
const mockedFromFilePath = MessageMedia.fromFilePath as jest.Mock;
const mockedUnlinkSync = fs.unlinkSync as jest.Mock;
const mockedUserMessagesLogCreate = UserMessagesLog.create as jest.Mock;
const mockedStartWhatsAppSessionVerify = StartWhatsAppSessionVerify as jest.Mock;
const mockedLoggerError = logger.error as jest.Mock;

const buildTicket = () =>
  ({
    id: 42,
    whatsappId: 7,
    isGroup: false,
    contact: {
      number: "5511999999999"
    },
    update: jest.fn().mockResolvedValue(undefined)
  } as any);

const media = {
  path: "/tmp/uploaded-audio.ogg",
  filename: "uploaded-audio.ogg"
} as any;

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends media, updates ticket state and records the user message log", async () => {
    const ticket = buildTicket();
    const wbot = {
      sendMessage: jest.fn().mockResolvedValue({ id: { id: "msg-123" } })
    };
    const mediaPayload = { mimetype: "audio/ogg" };

    mockedGetTicketWbot.mockResolvedValue(wbot);
    mockedFromFilePath.mockReturnValue(mediaPayload);

    const response = await SendWhatsAppMedia({
      media,
      ticket,
      userId: 99
    });

    expect(response).toEqual({ id: { id: "msg-123" } });
    expect(mockedFromFilePath).toHaveBeenCalledWith(media.path);
    expect(wbot.sendMessage).toHaveBeenCalledWith(
      "5511999999999@c.us",
      mediaPayload,
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: media.filename,
      lastMessageAt: expect.any(Number)
    });
    expect(mockedUserMessagesLogCreate).toHaveBeenCalledWith({
      messageId: "msg-123",
      userId: 99,
      ticketId: 42
    });
    expect(mockedUnlinkSync).toHaveBeenCalledWith(media.path);
    expect(mockedStartWhatsAppSessionVerify).not.toHaveBeenCalled();
  });

  it("verifies the WhatsApp session before surfacing a send failure", async () => {
    const ticket = buildTicket();
    const sendError = new Error("session disconnected");
    const wbot = {
      sendMessage: jest.fn().mockRejectedValue(sendError)
    };

    mockedGetTicketWbot.mockResolvedValue(wbot);
    mockedFromFilePath.mockReturnValue({ mimetype: "audio/ogg" });

    await expect(
      SendWhatsAppMedia({
        media,
        ticket,
        userId: 99
      })
    ).rejects.toMatchObject(new AppError("ERR_SENDING_WAPP_MSG"));

    expect(mockedLoggerError).toHaveBeenCalledWith(
      `SendWhatsAppMedia | Error: ${sendError}`
    );
    expect(mockedStartWhatsAppSessionVerify).toHaveBeenCalledWith(
      ticket.whatsappId,
      sendError
    );
    expect(ticket.update).not.toHaveBeenCalled();
    expect(mockedUserMessagesLogCreate).not.toHaveBeenCalled();
    expect(mockedUnlinkSync).not.toHaveBeenCalled();
  });
});
