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
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import UserMessagesLog from "../../../models/UserMessagesLog";
import { logger } from "../../../utils/logger";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

const mockedFs = fs as unknown as { unlinkSync: jest.Mock };
const mockedMessageMedia = MessageMedia as unknown as {
  fromFilePath: jest.Mock;
};
const mockedGetTicketWbot = GetTicketWbot as unknown as jest.Mock;
const mockedUserMessagesLog = UserMessagesLog as unknown as {
  create: jest.Mock;
};
const mockedLogger = logger as unknown as { error: jest.Mock };
const mockedStartWhatsAppSessionVerify =
  StartWhatsAppSessionVerify as unknown as jest.Mock;

const buildTicket = () =>
  ({
    id: 77,
    whatsappId: 9,
    isGroup: false,
    contact: {
      number: "5511999999999"
    },
    update: jest.fn().mockResolvedValue(undefined)
  } as any);

const buildMedia = () =>
  ({
    path: "/tmp/uploaded-file.ogg",
    filename: "audio.ogg"
  } as Express.Multer.File);

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("envia a midia, atualiza o ticket, registra o usuario e remove o arquivo temporario", async () => {
    const ticket = buildTicket();
    const media = buildMedia();
    const newMedia = { mimetype: "audio/ogg" };
    const sentMessage = {
      id: {
        id: "message-id"
      }
    };
    const sendMessage = jest.fn().mockResolvedValue(sentMessage);
    mockedMessageMedia.fromFilePath.mockReturnValue(newMedia);
    mockedGetTicketWbot.mockResolvedValue({ sendMessage });
    mockedUserMessagesLog.create.mockResolvedValue(undefined);

    const result = await SendWhatsAppMedia({
      media,
      ticket,
      userId: 15
    });

    expect(result).toBe(sentMessage);
    expect(mockedMessageMedia.fromFilePath).toHaveBeenCalledWith(media.path);
    expect(sendMessage).toHaveBeenCalledWith("5511999999999@c.us", newMedia, {
      sendAudioAsVoice: true
    });
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: "audio.ogg",
      lastMessageAt: expect.any(Number)
    });
    expect(mockedUserMessagesLog.create).toHaveBeenCalledWith({
      messageId: "message-id",
      userId: 15,
      ticketId: 77
    });
    expect(mockedFs.unlinkSync).toHaveBeenCalledWith(media.path);
    expect(mockedStartWhatsAppSessionVerify).not.toHaveBeenCalled();
  });

  it("continua o envio quando o log de usuario falha e registra o erro", async () => {
    const ticket = buildTicket();
    const media = buildMedia();
    const newMedia = { mimetype: "image/png" };
    const sentMessage = {
      id: {
        id: "message-id"
      }
    };
    const logError = new Error("log unavailable");
    mockedMessageMedia.fromFilePath.mockReturnValue(newMedia);
    mockedGetTicketWbot.mockResolvedValue({
      sendMessage: jest.fn().mockResolvedValue(sentMessage)
    });
    mockedUserMessagesLog.create.mockRejectedValue(logError);

    await expect(
      SendWhatsAppMedia({
        media,
        ticket,
        userId: 15
      })
    ).resolves.toBe(sentMessage);

    expect(mockedLogger.error).toHaveBeenCalledWith(
      `Error criar log mensagem ${logError}`
    );
    expect(mockedFs.unlinkSync).toHaveBeenCalledWith(media.path);
    expect(mockedStartWhatsAppSessionVerify).not.toHaveBeenCalled();
  });

  it("aciona verificacao de sessao e rejeita com erro de envio quando o WhatsApp falha", async () => {
    const ticket = buildTicket();
    const media = buildMedia();
    const sendError = new Error("Session closed");
    mockedMessageMedia.fromFilePath.mockReturnValue({ mimetype: "audio/ogg" });
    mockedGetTicketWbot.mockResolvedValue({
      sendMessage: jest.fn().mockRejectedValue(sendError)
    });

    await expect(
      SendWhatsAppMedia({
        media,
        ticket,
        userId: 15
      })
    ).rejects.toMatchObject({
      message: "ERR_SENDING_WAPP_MSG",
      statusCode: 400
    });

    expect(mockedLogger.error).toHaveBeenCalledWith(
      `SendWhatsAppMedia | Error: ${sendError}`
    );
    expect(mockedStartWhatsAppSessionVerify).toHaveBeenCalledWith(9, sendError);
    expect(mockedFs.unlinkSync).not.toHaveBeenCalled();
  });
});
