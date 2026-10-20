jest.mock("fs", () => ({
  unlinkSync: jest.fn()
}));
jest.mock("whatsapp-web.js", () => ({
  MessageMedia: {
    fromFilePath: jest.fn(() => ({ media: true }))
  }
}));
jest.mock("../../helpers/GetTicketWbot", () => jest.fn());
jest.mock("../../models/UserMessagesLog", () => ({
  __esModule: true,
  default: {
    create: jest.fn()
  }
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

const getTicketWbotMock = GetTicketWbot as jest.Mock;
const fromFilePathMock = MessageMedia.fromFilePath as jest.Mock;
const userMessagesLogCreateMock = UserMessagesLog.create as jest.Mock;
const startWhatsAppSessionVerifyMock = StartWhatsAppSessionVerify as jest.Mock;
const unlinkSyncMock = fs.unlinkSync as jest.Mock;

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const media = {
    path: "/tmp/audio.ogg",
    filename: "audio.ogg"
  } as Express.Multer.File;

  const buildTicket = () =>
    ({
      id: 10,
      whatsappId: 55,
      isGroup: false,
      contact: {
        number: "5511999999999"
      },
      update: jest.fn()
    } as any);

  it("sends the media, records the user log and removes the temporary file", async () => {
    const sendMessage = jest.fn().mockResolvedValue({
      id: {
        id: "message-id"
      }
    });
    const ticket = buildTicket();
    getTicketWbotMock.mockResolvedValue({ sendMessage });

    const result = await SendWhatsAppMedia({
      media,
      ticket,
      userId: 7
    });

    expect(fromFilePathMock).toHaveBeenCalledWith(media.path);
    expect(sendMessage).toHaveBeenCalledWith(
      "5511999999999@c.us",
      { media: true },
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: "audio.ogg",
      lastMessageAt: expect.any(Number)
    });
    expect(userMessagesLogCreateMock).toHaveBeenCalledWith({
      messageId: "message-id",
      userId: 7,
      ticketId: 10
    });
    expect(unlinkSyncMock).toHaveBeenCalledWith(media.path);
    expect(result).toEqual({
      id: {
        id: "message-id"
      }
    });
  });

  it("verifies the WhatsApp session before wrapping send failures", async () => {
    const sendError = new Error("Session closed");
    const ticket = buildTicket();
    getTicketWbotMock.mockResolvedValue({
      sendMessage: jest.fn().mockRejectedValue(sendError)
    });

    await expect(
      SendWhatsAppMedia({
        media,
        ticket,
        userId: 7
      })
    ).rejects.toMatchObject({
      message: "ERR_SENDING_WAPP_MSG"
    });

    expect(startWhatsAppSessionVerifyMock).toHaveBeenCalledWith(55, sendError);
    expect(unlinkSyncMock).not.toHaveBeenCalled();
  });
});
