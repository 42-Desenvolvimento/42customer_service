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
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import UserMessagesLog from "../../../models/UserMessagesLog";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

describe("SendWhatsAppMedia", () => {
  const media = {
    filename: "audio.ogg",
    path: "/tmp/audio.ogg"
  } as Express.Multer.File;

  const createTicket = () =>
    ({
      id: 10,
      whatsappId: 20,
      isGroup: false,
      contact: {
        number: "5511888888888"
      },
      update: jest.fn().mockResolvedValue(undefined)
    } as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends media, records the user message log and removes the uploaded file", async () => {
    const ticket = createTicket();
    const newMedia = { mimetype: "audio/ogg" };
    const sendMessage = {
      id: {
        id: "message-id"
      }
    };
    const wbot = {
      sendMessage: jest.fn().mockResolvedValue(sendMessage)
    };

    (GetTicketWbot as jest.Mock).mockResolvedValue(wbot);
    (MessageMedia.fromFilePath as jest.Mock).mockReturnValue(newMedia);
    (UserMessagesLog.create as jest.Mock).mockResolvedValue(undefined);

    await expect(
      SendWhatsAppMedia({ media, ticket, userId: 99 })
    ).resolves.toBe(sendMessage);

    expect(MessageMedia.fromFilePath).toHaveBeenCalledWith("/tmp/audio.ogg");
    expect(wbot.sendMessage).toHaveBeenCalledWith(
      "5511888888888@c.us",
      newMedia,
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: "audio.ogg",
      lastMessageAt: expect.any(Number)
    });
    expect(UserMessagesLog.create).toHaveBeenCalledWith({
      messageId: "message-id",
      userId: 99,
      ticketId: 10
    });
    expect(fs.unlinkSync).toHaveBeenCalledWith("/tmp/audio.ogg");
  });

  it("verifies the whatsapp session with the original error before returning the sending error", async () => {
    const ticket = createTicket();
    const originalError = new Error("session closed");
    const wbot = {
      sendMessage: jest.fn().mockRejectedValue(originalError)
    };

    (GetTicketWbot as jest.Mock).mockResolvedValue(wbot);
    (MessageMedia.fromFilePath as jest.Mock).mockReturnValue({
      mimetype: "audio/ogg"
    });

    await expect(
      SendWhatsAppMedia({ media, ticket, userId: undefined })
    ).rejects.toMatchObject({
      message: "ERR_SENDING_WAPP_MSG"
    });

    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(
      20,
      originalError
    );
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
});
