import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import UserMessagesLog from "../../../models/UserMessagesLog";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { logger } from "../../../utils/logger";

jest.mock("fs", () => {
  const mockUnlinkSync = jest.fn();

  return {
    __esModule: true,
    default: {
      unlinkSync: mockUnlinkSync
    },
    unlinkSync: mockUnlinkSync
  };
});

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
  const userMessagesLogCreateMock = UserMessagesLog.create as jest.Mock;
  const startWhatsAppSessionVerifyMock = StartWhatsAppSessionVerify as jest.Mock;
  const loggerErrorMock = logger.error as jest.Mock;
  const unlinkSyncMock = fs.unlinkSync as jest.Mock;

  const media = {
    path: "/tmp/audio.ogg",
    filename: "audio.ogg"
  } as Express.Multer.File;

  const createTicket = () =>
    ({
      id: 30,
      whatsappId: 40,
      isGroup: false,
      contact: {
        number: "5511999999999"
      },
      update: jest.fn()
    } as any);

  beforeEach(() => {
    jest.clearAllMocks();
    fromFilePathMock.mockReturnValue({ mimetype: "audio/ogg" });
  });

  it("sends media, updates the ticket and records the user message log", async () => {
    const ticket = createTicket();
    const sendMessage = {
      id: {
        id: "wamid-1"
      }
    };
    const wbot = {
      sendMessage: jest.fn().mockResolvedValue(sendMessage)
    };
    getTicketWbotMock.mockResolvedValue(wbot);

    const result = await SendWhatsAppMedia({
      media,
      ticket,
      userId: 50
    });

    expect(result).toBe(sendMessage);
    expect(fromFilePathMock).toHaveBeenCalledWith("/tmp/audio.ogg");
    expect(wbot.sendMessage).toHaveBeenCalledWith(
      "5511999999999@c.us",
      { mimetype: "audio/ogg" },
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: "audio.ogg",
      lastMessageAt: expect.any(Number)
    });
    expect(userMessagesLogCreateMock).toHaveBeenCalledWith({
      messageId: "wamid-1",
      userId: 50,
      ticketId: 30
    });
    expect(unlinkSyncMock).toHaveBeenCalledWith("/tmp/audio.ogg");
    expect(startWhatsAppSessionVerifyMock).not.toHaveBeenCalled();
  });

  it("asks for WhatsApp session verification when sending media fails", async () => {
    const ticket = createTicket();
    const error = new Error("Session closed");
    const wbot = {
      sendMessage: jest.fn().mockRejectedValue(error)
    };
    getTicketWbotMock.mockResolvedValue(wbot);

    await expect(
      SendWhatsAppMedia({
        media,
        ticket,
        userId: 50
      })
    ).rejects.toMatchObject({
      message: "ERR_SENDING_WAPP_MSG"
    });

    expect(loggerErrorMock).toHaveBeenCalledWith(
      `SendWhatsAppMedia | Error: ${error}`
    );
    expect(startWhatsAppSessionVerifyMock).toHaveBeenCalledWith(40, error);
    expect(userMessagesLogCreateMock).not.toHaveBeenCalled();
    expect(unlinkSyncMock).not.toHaveBeenCalled();
  });
});
