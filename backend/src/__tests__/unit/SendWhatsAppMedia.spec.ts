jest.mock("fs", () => ({
  unlinkSync: jest.fn()
}));

jest.mock("whatsapp-web.js", () => ({
  MessageMedia: {
    fromFilePath: jest.fn()
  }
}));

jest.mock("../../helpers/GetTicketWbot", () => jest.fn());

jest.mock("../../models/UserMessagesLog", () => ({
  create: jest.fn()
}));

jest.mock("../../utils/logger", () => ({
  logger: {
    error: jest.fn()
  }
}));

jest.mock("../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));

import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import UserMessagesLog from "../../models/UserMessagesLog";
import SendWhatsAppMedia from "../../services/WbotServices/SendWhatsAppMedia";
import { StartWhatsAppSessionVerify } from "../../services/WbotServices/StartWhatsAppSessionVerify";

const mockedGetTicketWbot = GetTicketWbot as jest.Mock;
const mockedFromFilePath = MessageMedia.fromFilePath as jest.Mock;
const mockedCreateUserMessageLog = UserMessagesLog.create as jest.Mock;
const mockedUnlinkSync = fs.unlinkSync as jest.Mock;
const mockedStartWhatsAppSessionVerify = StartWhatsAppSessionVerify as jest.Mock;

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends media, updates ticket metadata, records the sender and removes the temp file", async () => {
    const sentMessage = { id: { id: "message-123" } };
    const mediaPayload = { mimetype: "image/png" };
    const sendMessage = jest.fn().mockResolvedValue(sentMessage);
    const update = jest.fn().mockResolvedValue(undefined);

    mockedGetTicketWbot.mockResolvedValue({ sendMessage });
    mockedFromFilePath.mockReturnValue(mediaPayload);

    const getTime = jest
      .spyOn(Date.prototype, "getTime")
      .mockReturnValue(123456789);

    const ticket = {
      id: 42,
      whatsappId: 9,
      isGroup: false,
      contact: { number: "5511999999999" },
      update
    };
    const media = {
      path: "/tmp/uploaded-image.png",
      filename: "uploaded-image.png"
    };

    const result = await SendWhatsAppMedia({
      media: media as Express.Multer.File,
      ticket: ticket as any,
      userId: 77
    });

    expect(result).toBe(sentMessage);
    expect(mockedFromFilePath).toHaveBeenCalledWith(media.path);
    expect(sendMessage).toHaveBeenCalledWith(
      "5511999999999@c.us",
      mediaPayload,
      { sendAudioAsVoice: true }
    );
    expect(update).toHaveBeenCalledWith({
      lastMessage: media.filename,
      lastMessageAt: 123456789
    });
    expect(mockedCreateUserMessageLog).toHaveBeenCalledWith({
      messageId: "message-123",
      userId: 77,
      ticketId: 42
    });
    expect(mockedUnlinkSync).toHaveBeenCalledWith(media.path);

    getTime.mockRestore();
  });

  it("verifies the WhatsApp session and returns the business error when sending fails", async () => {
    const sendError = new Error("session closed");
    const sendMessage = jest.fn().mockRejectedValue(sendError);

    mockedGetTicketWbot.mockResolvedValue({ sendMessage });
    mockedFromFilePath.mockReturnValue({ mimetype: "application/pdf" });

    const ticket = {
      id: 50,
      whatsappId: 12,
      isGroup: true,
      contact: { number: "5511888888888" },
      update: jest.fn()
    };

    await expect(
      SendWhatsAppMedia({
        media: {
          path: "/tmp/file.pdf",
          filename: "file.pdf"
        } as Express.Multer.File,
        ticket: ticket as any,
        userId: undefined
      })
    ).rejects.toMatchObject({
      message: "ERR_SENDING_WAPP_MSG",
      statusCode: 400
    });

    expect(mockedStartWhatsAppSessionVerify).toHaveBeenCalledWith(
      12,
      sendError
    );
    expect(mockedUnlinkSync).not.toHaveBeenCalled();
  });
});
