import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import UserMessagesLog from "../../models/UserMessagesLog";
import SendWhatsAppMedia from "../../services/WbotServices/SendWhatsAppMedia";
import { StartWhatsAppSessionVerify } from "../../services/WbotServices/StartWhatsAppSessionVerify";
import { logger } from "../../utils/logger";

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
jest.mock("../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));
jest.mock("../../utils/logger", () => ({
  logger: {
    error: jest.fn()
  }
}));

const getTicketWbotMock = GetTicketWbot as jest.Mock;
const fromFilePathMock = MessageMedia.fromFilePath as jest.Mock;
const userMessagesLogCreateMock = UserMessagesLog.create as jest.Mock;
const startWhatsAppSessionVerifyMock = StartWhatsAppSessionVerify as jest.Mock;
const loggerErrorMock = logger.error as jest.Mock;
const unlinkSyncMock = fs.unlinkSync as jest.Mock;

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("verifies the WhatsApp session before surfacing media send failures", async () => {
    const sendError = new Error("send failed");
    const sendMessage = jest.fn().mockRejectedValue(sendError);
    getTicketWbotMock.mockResolvedValue({ sendMessage });
    fromFilePathMock.mockReturnValue({ mimetype: "image/png" });

    const ticket = {
      id: 44,
      whatsappId: 88,
      isGroup: false,
      contact: {
        number: "5511999999999"
      },
      update: jest.fn()
    };
    const media = {
      filename: "receipt.png",
      path: "/tmp/receipt.png"
    } as Express.Multer.File;

    try {
      await SendWhatsAppMedia({
        media,
        ticket: ticket as any,
        userId: 12
      });
      throw new Error("Expected SendWhatsAppMedia to fail");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).message).toBe("ERR_SENDING_WAPP_MSG");
    }

    expect(sendMessage).toHaveBeenCalledWith(
      "5511999999999@c.us",
      { mimetype: "image/png" },
      { sendAudioAsVoice: true }
    );
    expect(startWhatsAppSessionVerifyMock).toHaveBeenCalledWith(88, sendError);
    expect(loggerErrorMock).toHaveBeenCalledWith(
      `SendWhatsAppMedia | Error: ${sendError}`
    );
    expect(userMessagesLogCreateMock).not.toHaveBeenCalled();
    expect(unlinkSyncMock).not.toHaveBeenCalled();
  });
});
