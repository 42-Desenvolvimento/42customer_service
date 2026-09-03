import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import AppError from "../../../errors/AppError";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import UserMessagesLog from "../../../models/UserMessagesLog";

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

jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn()
  }
}));

describe("SendWhatsAppMedia", () => {
  const media = {
    path: "/tmp/audio.ogg",
    filename: "audio.ogg"
  } as Express.Multer.File;

  const buildTicket = () =>
    ({
      id: 12,
      whatsappId: 99,
      isGroup: false,
      contact: {
        number: "5511999999999"
      },
      update: jest.fn()
    } as any);

  beforeEach(() => {
    jest.clearAllMocks();
    (MessageMedia.fromFilePath as jest.Mock).mockReturnValue({
      mimetype: "audio/ogg"
    });
  });

  it("envia midia, atualiza ticket, grava log de usuario e remove arquivo local", async () => {
    const sendMessage = { id: { id: "message-id" } };
    const wbot = {
      sendMessage: jest.fn().mockResolvedValue(sendMessage)
    };
    const ticket = buildTicket();
    (GetTicketWbot as jest.Mock).mockResolvedValue(wbot);

    await expect(
      SendWhatsAppMedia({ media, ticket, userId: 5 })
    ).resolves.toBe(sendMessage);

    expect(MessageMedia.fromFilePath).toHaveBeenCalledWith(media.path);
    expect(wbot.sendMessage).toHaveBeenCalledWith(
      "5511999999999@c.us",
      { mimetype: "audio/ogg" },
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: media.filename,
      lastMessageAt: expect.any(Number)
    });
    expect(UserMessagesLog.create).toHaveBeenCalledWith({
      messageId: "message-id",
      userId: 5,
      ticketId: 12
    });
    expect(fs.unlinkSync).toHaveBeenCalledWith(media.path);
    expect(StartWhatsAppSessionVerify).not.toHaveBeenCalled();
  });

  it("aciona verificacao da sessao quando o envio de midia falha", async () => {
    const error = new Error("Session closed");
    const wbot = {
      sendMessage: jest.fn().mockRejectedValue(error)
    };
    const ticket = buildTicket();
    (GetTicketWbot as jest.Mock).mockResolvedValue(wbot);

    await expect(
      SendWhatsAppMedia({ media, ticket, userId: 5 })
    ).rejects.toMatchObject(new AppError("ERR_SENDING_WAPP_MSG"));

    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(
      ticket.whatsappId,
      error
    );
    expect(UserMessagesLog.create).not.toHaveBeenCalled();
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
});
