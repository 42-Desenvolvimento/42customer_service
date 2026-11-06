import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import UserMessagesLog from "../../../models/UserMessagesLog";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

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

describe("SendWhatsAppMedia", () => {
  const unlinkSyncMock = fs.unlinkSync as jest.Mock;
  const fromFilePathMock = MessageMedia.fromFilePath as jest.Mock;
  const getTicketWbotMock = GetTicketWbot as jest.Mock;
  const userMessagesLogCreateMock = UserMessagesLog.create as jest.Mock;
  const startWhatsAppSessionVerifyMock = StartWhatsAppSessionVerify as jest.Mock;

  const buildTicket = (overrides = {}) =>
    ({
      id: 321,
      whatsappId: 88,
      isGroup: false,
      contact: {
        number: "5511888888888"
      },
      update: jest.fn().mockResolvedValue(undefined),
      ...overrides
    } as any);

  const media = {
    path: "/tmp/uploaded-media.png",
    filename: "uploaded-media.png"
  } as Express.Multer.File;

  beforeEach(() => {
    unlinkSyncMock.mockReset();
    fromFilePathMock.mockReset();
    getTicketWbotMock.mockReset();
    userMessagesLogCreateMock.mockReset();
    startWhatsAppSessionVerifyMock.mockReset();
  });

  it("sends media, records user message log, updates ticket, and removes the temp file", async () => {
    const ticket = buildTicket();
    const mediaPayload = { mimetype: "image/png" };
    const sentMessage = {
      id: {
        id: "message-id"
      }
    };
    const sendMessage = jest.fn().mockResolvedValue(sentMessage);

    fromFilePathMock.mockReturnValue(mediaPayload);
    getTicketWbotMock.mockResolvedValue({ sendMessage });

    const result = await SendWhatsAppMedia({
      media,
      ticket,
      userId: 17
    });

    expect(result).toBe(sentMessage);
    expect(fromFilePathMock).toHaveBeenCalledWith("/tmp/uploaded-media.png");
    expect(sendMessage).toHaveBeenCalledWith(
      "5511888888888@c.us",
      mediaPayload,
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: "uploaded-media.png",
      lastMessageAt: expect.any(Number)
    });
    expect(userMessagesLogCreateMock).toHaveBeenCalledWith({
      messageId: "message-id",
      userId: 17,
      ticketId: 321
    });
    expect(unlinkSyncMock).toHaveBeenCalledWith("/tmp/uploaded-media.png");
    expect(startWhatsAppSessionVerifyMock).not.toHaveBeenCalled();
  });

  it("verifies the whatsapp session and throws AppError when media sending fails", async () => {
    const ticket = buildTicket();
    const error = new Error("Session closed");

    fromFilePathMock.mockReturnValue({ mimetype: "image/png" });
    getTicketWbotMock.mockResolvedValue({
      sendMessage: jest.fn().mockRejectedValue(error)
    });

    await expect(
      SendWhatsAppMedia({
        media,
        ticket,
        userId: 17
      })
    ).rejects.toMatchObject({
      message: "ERR_SENDING_WAPP_MSG",
      statusCode: 400
    });

    expect(startWhatsAppSessionVerifyMock).toHaveBeenCalledWith(88, error);
    expect(unlinkSyncMock).not.toHaveBeenCalled();
    expect(userMessagesLogCreateMock).not.toHaveBeenCalled();
  });
});
