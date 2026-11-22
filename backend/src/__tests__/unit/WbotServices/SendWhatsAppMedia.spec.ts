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

import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import UserMessagesLog from "../../../models/UserMessagesLog";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";

const unlinkSyncMock = fs.unlinkSync as jest.Mock;
const fromFilePathMock = MessageMedia.fromFilePath as jest.Mock;
const GetTicketWbotMock = GetTicketWbot as jest.Mock;
const UserMessagesLogMock = UserMessagesLog as unknown as { create: jest.Mock };
const StartWhatsAppSessionVerifyMock = StartWhatsAppSessionVerify as jest.Mock;

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends media, stores the user log and removes the uploaded file", async () => {
    const mediaContent = { mimetype: "image/png" };
    const sentMessage = { id: { id: "message-id" } };
    const sendMessage = jest.fn().mockResolvedValue(sentMessage);
    const ticket = {
      id: 33,
      whatsappId: 10,
      isGroup: true,
      contact: { number: "5511888888888" },
      update: jest.fn().mockResolvedValue(undefined)
    };

    fromFilePathMock.mockReturnValue(mediaContent);
    GetTicketWbotMock.mockResolvedValue({ sendMessage });
    UserMessagesLogMock.create.mockResolvedValue(undefined);

    await expect(
      SendWhatsAppMedia({
        media: {
          path: "/tmp/uploaded-media",
          filename: "uploaded-media.png"
        } as Express.Multer.File,
        ticket: ticket as any,
        userId: 42
      })
    ).resolves.toBe(sentMessage);

    expect(fromFilePathMock).toHaveBeenCalledWith("/tmp/uploaded-media");
    expect(sendMessage).toHaveBeenCalledWith(
      "5511888888888@g.us",
      mediaContent,
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: "uploaded-media.png",
      lastMessageAt: expect.any(Number)
    });
    expect(UserMessagesLogMock.create).toHaveBeenCalledWith({
      messageId: "message-id",
      userId: 42,
      ticketId: 33
    });
    expect(unlinkSyncMock).toHaveBeenCalledWith("/tmp/uploaded-media");
    expect(StartWhatsAppSessionVerifyMock).not.toHaveBeenCalled();
  });

  it("starts WhatsApp session verification and raises AppError when sending fails", async () => {
    const sendError = new Error("session closed");
    const sendMessage = jest.fn().mockRejectedValue(sendError);
    const ticket = {
      id: 34,
      whatsappId: 11,
      isGroup: false,
      contact: { number: "5511777777777" },
      update: jest.fn()
    };

    fromFilePathMock.mockReturnValue({ mimetype: "image/png" });
    GetTicketWbotMock.mockResolvedValue({ sendMessage });

    await expect(
      SendWhatsAppMedia({
        media: {
          path: "/tmp/broken-media",
          filename: "broken-media.png"
        } as Express.Multer.File,
        ticket: ticket as any,
        userId: undefined
      })
    ).rejects.toMatchObject({
      message: "ERR_SENDING_WAPP_MSG",
      statusCode: 400
    });

    expect(StartWhatsAppSessionVerifyMock).toHaveBeenCalledWith(11, sendError);
    expect(UserMessagesLogMock.create).not.toHaveBeenCalled();
    expect(unlinkSyncMock).not.toHaveBeenCalled();
  });
});

export {};
