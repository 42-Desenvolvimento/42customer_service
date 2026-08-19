jest.mock("fs", () => ({
  __esModule: true,
  default: {
    unlinkSync: jest.fn()
  }
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
    path: "/tmp/audio.ogg",
    filename: "audio.ogg"
  } as Express.Multer.File;

  const makeTicket = () =>
    ({
      id: 11,
      whatsappId: 22,
      isGroup: false,
      contact: {
        number: "5511999999999"
      },
      update: jest.fn()
    } as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends media, updates the ticket and records the user message log", async () => {
    const newMedia = { mimetype: "audio/ogg" };
    const sentMessage = { id: { id: "wamid-1" } };
    const sendMessage = jest.fn().mockResolvedValue(sentMessage);
    const ticket = makeTicket();

    (MessageMedia.fromFilePath as jest.Mock).mockReturnValue(newMedia);
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendMessage });

    await expect(
      SendWhatsAppMedia({
        media,
        ticket,
        userId: 99
      })
    ).resolves.toBe(sentMessage);

    expect(sendMessage).toHaveBeenCalledWith(
      "5511999999999@c.us",
      newMedia,
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: "audio.ogg",
      lastMessageAt: expect.any(Number)
    });
    expect(UserMessagesLog.create).toHaveBeenCalledWith({
      messageId: "wamid-1",
      userId: 99,
      ticketId: 11
    });
    expect(fs.unlinkSync).toHaveBeenCalledWith("/tmp/audio.ogg");
    expect(StartWhatsAppSessionVerify).not.toHaveBeenCalled();
  });

  it("verifies the WhatsApp session when media sending fails", async () => {
    const sendError = new Error("session closed");
    const sendMessage = jest.fn().mockRejectedValue(sendError);
    const ticket = makeTicket();

    (MessageMedia.fromFilePath as jest.Mock).mockReturnValue({
      mimetype: "audio/ogg"
    });
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendMessage });

    await expect(
      SendWhatsAppMedia({
        media,
        ticket,
        userId: 99
      })
    ).rejects.toMatchObject({
      message: "ERR_SENDING_WAPP_MSG"
    });

    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(22, sendError);
    expect(ticket.update).not.toHaveBeenCalled();
    expect(UserMessagesLog.create).not.toHaveBeenCalled();
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
});
