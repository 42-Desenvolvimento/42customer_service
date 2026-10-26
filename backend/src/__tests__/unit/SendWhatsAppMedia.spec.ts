const mockFromFilePath = jest.fn();
const mockSendMessage = jest.fn();

jest.mock("fs", () => ({
  unlinkSync: jest.fn()
}));

jest.mock("whatsapp-web.js", () => ({
  MessageMedia: {
    fromFilePath: mockFromFilePath
  }
}));

jest.mock("../../helpers/GetTicketWbot", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../models/Ticket", () => ({
  __esModule: true,
  default: jest.fn()
}));

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
import { StartWhatsAppSessionVerify } from "../../services/WbotServices/StartWhatsAppSessionVerify";
import SendWhatsAppMedia from "../../services/WbotServices/SendWhatsAppMedia";

const makeTicket = () =>
  ({
    id: 12,
    whatsappId: 4,
    isGroup: false,
    contact: {
      number: "5511888888888"
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
    mockFromFilePath.mockReturnValue({ mimetype: "audio/ogg" });
    (GetTicketWbot as jest.Mock).mockResolvedValue({
      sendMessage: mockSendMessage
    });
  });

  it("sends media, updates the ticket and records the user message log", async () => {
    const ticket = makeTicket();
    const sentMessage = {
      id: {
        id: "wbot-message-id"
      }
    };
    mockSendMessage.mockResolvedValue(sentMessage);

    await expect(
      SendWhatsAppMedia({
        media,
        ticket,
        userId: 99
      })
    ).resolves.toBe(sentMessage);

    expect(MessageMedia.fromFilePath).toHaveBeenCalledWith("/tmp/audio.ogg");
    expect(mockSendMessage).toHaveBeenCalledWith(
      "5511888888888@c.us",
      { mimetype: "audio/ogg" },
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: "audio.ogg",
      lastMessageAt: expect.any(Number)
    });
    expect(UserMessagesLog.create).toHaveBeenCalledWith({
      messageId: "wbot-message-id",
      userId: 99,
      ticketId: 12
    });
    expect(fs.unlinkSync).toHaveBeenCalledWith("/tmp/audio.ogg");
  });

  it("verifies the WhatsApp session and returns the service error on send failure", async () => {
    const ticket = makeTicket();
    const error = new Error("send failed");
    mockSendMessage.mockRejectedValue(error);

    await expect(
      SendWhatsAppMedia({
        media,
        ticket,
        userId: 99
      })
    ).rejects.toMatchObject({
      message: "ERR_SENDING_WAPP_MSG"
    });

    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(4, error);
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
});

export {};
