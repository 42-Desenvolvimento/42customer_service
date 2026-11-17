import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import UserMessagesLog from "../../../models/UserMessagesLog";
import { logger } from "../../../utils/logger";

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
  const getTicketWbotMock = GetTicketWbot as jest.Mock;
  const fromFilePathMock = MessageMedia.fromFilePath as jest.Mock;
  const userMessagesLogModel = UserMessagesLog as unknown as {
    create: jest.Mock;
  };
  const unlinkSyncMock = fs.unlinkSync as jest.Mock;
  const startWhatsAppSessionVerifyMock = StartWhatsAppSessionVerify as jest.Mock;
  const loggerMock = logger as unknown as { error: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("envia a midia, atualiza o ticket, registra o usuario e remove o arquivo temporario", async () => {
    const mediaPayload = { mimetype: "image/png" };
    const sentMessage = { id: { id: "message-id" } };
    const sendMessageMock = jest.fn().mockResolvedValue(sentMessage);
    const ticket = {
      id: 10,
      whatsappId: 30,
      isGroup: true,
      contact: {
        number: "5511999999999"
      },
      update: jest.fn().mockResolvedValue(undefined)
    };
    const media = {
      path: "/tmp/upload.png",
      filename: "upload.png"
    };

    getTicketWbotMock.mockResolvedValue({ sendMessage: sendMessageMock });
    fromFilePathMock.mockReturnValue(mediaPayload);
    userMessagesLogModel.create.mockResolvedValue({});

    const response = await SendWhatsAppMedia({
      media: media as Express.Multer.File,
      ticket: ticket as any,
      userId: 42
    });

    expect(response).toBe(sentMessage);
    expect(fromFilePathMock).toHaveBeenCalledWith(media.path);
    expect(sendMessageMock).toHaveBeenCalledWith(
      "5511999999999@g.us",
      mediaPayload,
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: media.filename,
      lastMessageAt: expect.any(Number)
    });
    expect(userMessagesLogModel.create).toHaveBeenCalledWith({
      messageId: sentMessage.id.id,
      userId: 42,
      ticketId: ticket.id
    });
    expect(unlinkSyncMock).toHaveBeenCalledWith(media.path);
    expect(startWhatsAppSessionVerifyMock).not.toHaveBeenCalled();
  });

  it("reinicia a sessao e retorna erro de negocio quando o envio da midia falha", async () => {
    const sendError = new Error("session closed");
    const ticket = {
      id: 10,
      whatsappId: 30,
      isGroup: false,
      contact: {
        number: "5511999999999"
      },
      update: jest.fn()
    };
    const media = {
      path: "/tmp/upload.png",
      filename: "upload.png"
    };

    getTicketWbotMock.mockRejectedValue(sendError);

    await expect(
      SendWhatsAppMedia({
        media: media as Express.Multer.File,
        ticket: ticket as any,
        userId: 42
      })
    ).rejects.toMatchObject({ message: "ERR_SENDING_WAPP_MSG" });

    expect(loggerMock.error).toHaveBeenCalledWith(
      `SendWhatsAppMedia | Error: ${sendError}`
    );
    expect(startWhatsAppSessionVerifyMock).toHaveBeenCalledWith(
      ticket.whatsappId,
      sendError
    );
    expect(unlinkSyncMock).not.toHaveBeenCalled();
    expect(userMessagesLogModel.create).not.toHaveBeenCalled();
  });
});
